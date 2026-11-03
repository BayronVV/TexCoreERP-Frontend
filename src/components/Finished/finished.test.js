import test from 'node:test'
import assert from 'node:assert/strict'

import {
  balance,
  confirmationText,
  differenceLabel,
  enteredTotal,
  entryBody,
  entryProblems,
  initialQuantities,
  plannedMap,
  recentEntries,
  signed,
  sizeSort,
  variantLabel,
  variantMatrix,
} from './finished.js'

const variants = [
  { id: 1, talla: '30', color: 'Azul oscuro' },
  { id: 2, talla: '32', color: 'Azul oscuro' },
  { id: 3, talla: '28', color: 'Negro' },
  { id: 4, talla: 'M', color: 'Negro' },
]
const pending = { inspeccion: 9, lote_codigo: 'OP-0300-L01', aptas: 50, planificado: [{ variante: 1, cantidad: 30 }, { variante: 2, cantidad: 20 }] }

test('sizeSort: numéricas por valor y las demás por nombre', () => {
  assert.deepEqual(['M', '32', 'S', '28', '30'].sort(sizeSort), ['28', '30', '32', 'M', 'S'])
})

test('variantMatrix: colores en filas y tallas ordenadas en columnas', () => {
  const { sizes, rows } = variantMatrix(variants)
  assert.deepEqual(sizes, ['28', '30', '32', 'M'])
  assert.deepEqual(rows.map((row) => row.color), ['Azul oscuro', 'Negro'])
  assert.equal(rows[0].cells['32'].id, 2)
  assert.equal(rows[1].cells['32'], undefined)
  assert.deepEqual(variantMatrix(undefined), { sizes: [], rows: [] })
})

test('plannedMap e initialQuantities: lo planificado solo si suma las aptas', () => {
  assert.deepEqual(plannedMap(pending), { 1: 30, 2: 20 })
  assert.deepEqual(initialQuantities(pending), { 1: '30', 2: '20' })
  assert.deepEqual(initialQuantities({ ...pending, aptas: 49 }), {}) // no cuadra: se deja vacío
  assert.deepEqual(initialQuantities({ aptas: 10, planificado: [] }), {})
})

test('enteredTotal y balance: faltan, sobran o cuadra', () => {
  assert.equal(enteredTotal({ 1: '30', 2: ' 20 ', 3: 'x', 4: '' }), 50) // lo mal escrito cuenta como cero
  assert.deepEqual(balance(50, { 1: '30', 2: '20' }), { sum: 50, difference: 0, ok: true, message: 'El reparto por talla cuadra con las aptas.' })
  assert.equal(balance(50, { 1: '49' }).message, 'Faltan 1 prenda por ubicar en una talla.')
  assert.equal(balance(50, { 1: '40' }).message, 'Faltan 10 prendas por ubicar en una talla.')
  assert.equal(balance(50, { 1: '51' }).message, 'Sobran 1 prenda: revisa las cantidades.')
  assert.equal(balance(50, { 1: '60' }).difference, -10)
})

test('entryProblems', () => {
  assert.deepEqual(entryProblems({ pending: null, quantities: {} }), ['Elige la inspección.'])
  assert.deepEqual(entryProblems({ pending, quantities: { 1: '30', 2: '20' } }), [])
  assert.equal(entryProblems({ pending, quantities: { 1: '30' } }).length, 1)
  assert.ok(entryProblems({ pending, quantities: { 1: '3.5', 2: '46' } })[0].includes('enteros'))
})

test('entryBody: solo las celdas con cantidad y confirmationText', () => {
  assert.deepEqual(entryBody({ pending, quantities: { 1: '30', 2: ' 20 ', 3: '', 4: '0' }, ubicacion: ' A2 ', observaciones: ' ok ' }), {
    inspeccion: 9, ubicacion: 'A2', observaciones: 'ok',
    lineas: [{ variante: 1, cantidad: 30 }, { variante: 2, cantidad: 20 }],
  })
  const text = confirmationText(pending, { 1: '30', 2: '20' })
  assert.ok(text.includes('50 prendas aptas') && text.includes('OP-0300-L01') && text.includes('no se puede editar'))
})

test('differenceLabel, signed y variantLabel', () => {
  assert.equal(differenceLabel({ diferencia: null }), '—')
  assert.equal(differenceLabel({ diferencia: 0 }), 'igual')
  assert.equal(differenceLabel({ diferencia: 5 }), '+5')
  assert.equal(differenceLabel({ diferencia: -5 }), '-5')
  assert.equal(signed(20), '+20')
  assert.equal(signed(-5), '−5')
  assert.equal(variantLabel(variants[0]), '30 · Azul oscuro')
})

test('recentEntries: ingresos de los últimos días contando hoy', () => {
  const entries = [{ fecha: '2026-11-03' }, { fecha: '2026-10-28' }, { fecha: '2026-10-27' }, { fecha: '2026-10-01' }]
  assert.deepEqual(recentEntries(entries, '2026-11-03', 7).map((e) => e.fecha), ['2026-11-03', '2026-10-28'])
  assert.deepEqual(recentEntries(undefined, '2026-11-03'), [])
})
