// Pruebas unitarias de las filas de la ficha técnica. Se ejecutan con `npm test`.
import test from 'node:test'
import assert from 'node:assert/strict'
import {
  emptyRow, formatBytes, grossPerGarment, isWhole, rowProblems, rowsFromLines, tableProblems, toPayload, usedByOthers,
} from './fichaRows.js'

const TELA = { id: 1, nombre: 'Denim', tipo: 'MATERIA_PRIMA', unidad: 'm' }
const CIERRE = { id: 2, nombre: 'Cierre', tipo: 'INSUMO', unidad: 'unidad' }
const GENERICO = { id: 3, nombre: 'Genérico', tipo: 'GENERICO', unidad: 'unidad' }
const PRODUCTS = { 1: TELA, 2: CIERRE, 3: GENERICO }
const productOf = (id) => PRODUCTS[id]
const row = (producto, cantidad, merma = '0') => ({ producto: String(producto), cantidad, merma, observaciones: '' })

test('isWhole: unidad, caja y rollo son enteras', () => {
  assert.deepEqual(['unidad', 'caja', 'rollo', 'm', 'kg', 'l'].map(isWhole), [true, true, true, false, false, false])
})

test('rowsFromLines pasa todo a texto y quita los ceros sobrantes', () => {
  const rows = rowsFromLines([{ producto: 1, cantidad: '1.500', merma: '10.00', observaciones: null }])
  assert.deepEqual(rows, [{ producto: '1', cantidad: '1.5', merma: '10', observaciones: '' }])
})

test('emptyRow empieza sin material y con merma 0', () => {
  assert.deepEqual(emptyRow(), { producto: '', cantidad: '', merma: '0', observaciones: '' })
})

test('grossPerGarment aplica la merma una sola vez', () => {
  assert.equal(grossPerGarment(row(1, '1.5', '10')), 1.65)
  assert.equal(grossPerGarment(row(1, '2', '0')), 2)
  assert.equal(grossPerGarment(row(1, '1.333', '10')), 1.4663)
})

test('grossPerGarment devuelve null con datos inválidos', () => {
  for (const bad of [row(1, ''), row(1, '0'), row(1, '-1'), row(1, 'abc'), row(1, '1', '-5'), row(1, '1', 'x')]) {
    assert.equal(grossPerGarment(bad), null)
  }
})

test('rowProblems: una fila correcta no tiene problemas', () => {
  assert.deepEqual(rowProblems(row(1, '1.5', '10'), TELA), [])
  assert.deepEqual(rowProblems(row(2, '5'), CIERRE), [])
})

test('rowProblems exige el material', () => {
  assert.deepEqual(rowProblems(emptyRow(), undefined), ['Elige el material.'])
})

test('rowProblems solo acepta materias primas e insumos', () => {
  assert.ok(rowProblems(row(3, '1'), GENERICO).includes('Solo materias primas e insumos.'))
})

test('rowProblems valida la cantidad', () => {
  assert.ok(rowProblems(row(1, ''), TELA).includes('Escribe la cantidad por prenda.'))
  assert.ok(rowProblems(row(1, '0'), TELA).includes('Escribe la cantidad por prenda.'))
  assert.ok(rowProblems(row(1, '-2'), TELA).includes('Escribe la cantidad por prenda.'))
  assert.ok(rowProblems(row(1, '1001'), TELA).includes('Máximo 1000 por prenda.'))
  assert.ok(rowProblems(row(1, '1.2345'), TELA).includes('Máximo 3 decimales.'))
  assert.deepEqual(rowProblems(row(1, '1.234'), TELA), [])
})

test('rowProblems: las unidades enteras no admiten decimales ni merma', () => {
  assert.ok(rowProblems(row(2, '1.5'), CIERRE).includes('Esta unidad se cuenta en piezas enteras.'))
  assert.ok(rowProblems(row(2, '1', '5'), CIERRE).includes('Las piezas enteras no llevan merma.'))
})

test('rowProblems valida la merma', () => {
  assert.ok(rowProblems(row(1, '1', '51'), TELA).includes('La merma va de 0 a 50 %.'))
  assert.ok(rowProblems(row(1, '1', '-1'), TELA).includes('La merma va de 0 a 50 %.'))
  assert.ok(rowProblems(row(1, '1', '5.555'), TELA).includes('La merma admite 2 decimales.'))
  assert.deepEqual(rowProblems(row(1, '1', '50'), TELA), [])
  assert.deepEqual(rowProblems(row(1, '1', ''), TELA), [])
})

test('tableProblems pide al menos un material', () => {
  assert.deepEqual(tableProblems([], productOf).general, ['Agrega al menos un material.'])
})

test('tableProblems detecta materiales repetidos', () => {
  const { general } = tableProblems([row(1, '1'), row(1, '2')], productOf)
  assert.ok(general.includes('Un material aparece dos veces.'))
})

test('tableProblems devuelve los problemas de cada fila', () => {
  const { general, byRow } = tableProblems([row(1, '1.5'), row(2, '1.5')], productOf)
  assert.deepEqual(general, [])
  assert.deepEqual(byRow[0], [])
  assert.deepEqual(byRow[1], ['Esta unidad se cuenta en piezas enteras.'])
})

test('tableProblems limita a 50 materiales', () => {
  const rows = Array.from({ length: 51 }, (_, i) => row(1000 + i, '1'))
  assert.ok(tableProblems(rows, () => TELA).general.includes('Máximo 50 materiales.'))
})

test('usedByOthers excluye la propia fila y los vacíos', () => {
  const rows = [row(1, '1'), row(2, '1'), emptyRow()]
  assert.deepEqual([...usedByOthers(rows, 0)], ['2'])
  assert.deepEqual([...usedByOthers(rows, 2)].sort(), ['1', '2'])
})

test('toPayload arma la ficha completa con los números como texto', () => {
  const body = toPayload({
    lavado: 'STONE_WASH', notas: 'Doble costura',
    rows: [{ producto: '1', cantidad: '1.5', merma: '', observaciones: '  Bolsillo  ' }],
  })
  assert.deepEqual(body, {
    lavado: 'STONE_WASH', notas: 'Doble costura',
    lineas: [{ producto: 1, cantidad: '1.5', merma: '0', observaciones: 'Bolsillo' }],
  })
})

test('formatBytes', () => {
  assert.equal(formatBytes(512), '512 B')
  assert.equal(formatBytes(1536), '1,5 KB')
  assert.equal(formatBytes(5 * 1024 * 1024), '5 MB')
  assert.equal(formatBytes(-1), '')
  assert.equal(formatBytes(NaN), '')
})
