import test from 'node:test'
import assert from 'node:assert/strict'

import {
  addDefectRow,
  availableDefects,
  balance,
  confirmationText,
  defectBody,
  defectForm,
  defectKindLabel,
  defectNameProblem,
  emptyDefectForm,
  flawedPercent,
  flawedTotal,
  inspectionBody,
  inspectionProblems,
  MAX_DEFECT_ROWS,
  removeDefectRow,
} from './quality.js'

const costura = { id: 1, nombre: 'Costura floja', corregible: true, activo: true }
const mancha = { id: 2, nombre: 'Mancha permanente', corregible: false, activo: true }
const apagado = { id: 3, nombre: 'Desactivado', corregible: false, activo: false }
const lot = { id: 7, codigo: 'OP-0300-L01', cantidad_recibida: 55 }

test('defectKindLabel', () => {
  assert.equal(defectKindLabel(costura), 'Corregible')
  assert.equal(defectKindLabel(mancha), 'Incorregible')
})

test('availableDefects: activos y sin repetir', () => {
  assert.deepEqual(availableDefects([costura, mancha, apagado], []).map((d) => d.id), [1, 2])
  assert.deepEqual(availableDefects([costura, mancha, apagado], [{ defecto: 1 }]).map((d) => d.id), [2])
  assert.deepEqual(availableDefects(undefined, []), [])
})

test('addDefectRow: agrega con nota y valida', () => {
  const first = addDefectRow([], costura, ' 3 ', ' Pretina ')
  assert.deepEqual(first.rows, [{ defecto: 1, nombre: 'Costura floja', corregible: true, cantidad: '3', nota: 'Pretina' }])
  assert.equal(addDefectRow(first.rows, mancha, '2').rows.length, 2)
  assert.ok(addDefectRow(first.rows, costura, '2').error.includes('ya está en el desglose'))
  assert.ok(addDefectRow([], null, '2').error)
  for (const bad of ['0', '', '-1', '1.5', 'abc']) assert.ok(addDefectRow([], costura, bad).error, bad)
  const full = Array.from({ length: MAX_DEFECT_ROWS }, (_, index) => ({ defecto: 100 + index, cantidad: '1' }))
  assert.ok(addDefectRow(full, costura, '1').error.includes('Máximo'))
})

test('removeDefectRow y flawedTotal', () => {
  const rows = [{ defecto: 1, cantidad: '3' }, { defecto: 2, cantidad: '2' }, { defecto: 4, cantidad: 'x' }]
  assert.deepEqual(removeDefectRow(rows, 2).map((r) => r.defecto), [1, 4])
  assert.equal(flawedTotal(rows), 5) // la fila mal escrita cuenta como cero
  assert.equal(flawedTotal([]), 0)
})

test('balance: faltan, sobran o cuadra', () => {
  const rows = [{ defecto: 1, cantidad: '3' }, { defecto: 2, cantidad: '2' }]
  assert.deepEqual(balance(55, '50', rows), { good: 50, flawed: 5, sum: 55, difference: 0, ok: true, message: 'Las aptas y las marras cuadran con lo recibido.' })
  assert.equal(balance(55, '49', rows).message, 'Faltan 1 prenda por clasificar.')
  assert.equal(balance(55, '40', rows).message, 'Faltan 10 prendas por clasificar.')
  assert.equal(balance(55, '51', rows).message, 'Sobran 1 prenda: revisa las cantidades.')
  assert.equal(balance(55, '60', rows).difference, -10)
  assert.equal(balance(55, '', rows).good, 0) // sin escribir las aptas cuentan como cero
  assert.equal(balance(55, '55', []).ok, true)
})

test('flawedPercent', () => {
  assert.equal(flawedPercent(5, 55), '9,1 %')
  assert.equal(flawedPercent(0, 55), '0,0 %')
  assert.equal(flawedPercent(3, 0), '0 %')
})

test('inspectionProblems: lista lo que falta para poder registrar', () => {
  const rows = [{ defecto: 1, cantidad: '5' }]
  assert.deepEqual(inspectionProblems({ lot: null, aptas: '50', rows }), ['Elige el lote.'])
  assert.deepEqual(inspectionProblems({ lot, aptas: '50', rows }), [])
  assert.equal(inspectionProblems({ lot, aptas: '', rows }).length, 1)
  assert.equal(inspectionProblems({ lot, aptas: '-1', rows }).length, 1)
  assert.ok(inspectionProblems({ lot, aptas: '10', rows })[0].startsWith('Faltan'))
  assert.ok(inspectionProblems({ lot, aptas: '50', rows: [{ defecto: 1, cantidad: '0' }] }).includes('Revisa las cantidades de las marras.'))
})

test('inspectionBody y confirmationText', () => {
  const rows = [{ defecto: 1, nombre: 'Costura floja', cantidad: '3', nota: 'Pretina' }, { defecto: 2, nombre: 'Mancha', cantidad: '2', nota: '' }]
  assert.deepEqual(inspectionBody({ lot, aptas: ' 50 ', rows, observaciones: ' ok ' }), {
    lote: 7, aptas: 50, observaciones: 'ok',
    defectos: [{ defecto: 1, cantidad: 3, nota: 'Pretina' }, { defecto: 2, cantidad: 2, nota: '' }],
  })
  const text = confirmationText({ lot, aptas: '50', rows })
  assert.ok(text.includes('OP-0300-L01') && text.includes('50 aptas') && text.includes('5 marras') && text.includes('55 recibidas'))
  assert.ok(text.includes('no se puede editar'))
})

test('defectos: nombre, formulario y cuerpo', () => {
  assert.ok(defectNameProblem('ab'))
  assert.ok(defectNameProblem('x'.repeat(81)))
  assert.equal(defectNameProblem('  Costura   floja '), '')
  assert.deepEqual(emptyDefectForm(), { nombre: '', descripcion: '', corregible: 'si' })
  assert.deepEqual(defectBody({ nombre: '  Costura   floja ', descripcion: ' x ', corregible: 'no' }), { nombre: 'Costura floja', descripcion: 'x', corregible: false })
  assert.deepEqual(defectForm({ nombre: 'A', descripcion: null, corregible: true }), { nombre: 'A', descripcion: '', corregible: 'si' })
})
