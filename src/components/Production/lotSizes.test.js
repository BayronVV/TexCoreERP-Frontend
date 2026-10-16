// Pruebas unitarias de la lógica de tallas por lote y del cuerpo de la orden. Se ejecutan con `npm test`.
import test from 'node:test'
import assert from 'node:assert/strict'
import {
  buildOrderBody, effectiveLots, emptySizeRow, orderProblems, sizeProblems, sizeTotals, splitByUnits, takenByOthers,
} from './lotSizes.js'

const row = (variante, cantidad) => ({ variante, cantidad })
const REFERENCE = { id: 1, tiene_ficha: true }
const VARIANTS = { 1: { talla: '30', color: 'Azul' }, 2: { talla: '32', color: 'Azul' }, 10: { talla: '4', color: 'Negro' } }
const variantOf = (id) => VARIANTS[id]

test('emptySizeRow empieza sin variante ni cantidad', () => {
  assert.deepEqual(emptySizeRow(), { variante: '', cantidad: '' })
})

test('splitByUnits: el último lote lleva el resto', () => {
  assert.deepEqual(splitByUnits(100, 30), [30, 30, 30, 10])
  assert.deepEqual(splitByUnits('90', '30'), [30, 30, 30])
  assert.deepEqual(splitByUnits(10, 50), [10])
})

test('splitByUnits devuelve vacío con datos inválidos o demasiados lotes', () => {
  for (const [total, size] of [['', 5], [10, 0], [10, 2.5], ['x', 3], [10, -1]]) assert.deepEqual(splitByUnits(total, size), [])
  assert.deepEqual(splitByUnits(51, 1), []) // 51 lotes
  assert.equal(splitByUnits(50, 1).length, 50)
})

test('splitByUnits siempre suma el total', () => {
  for (const [total, size] of [[7, 2], [1000, 33], [1, 1], [99999, 2000]]) {
    assert.equal(splitByUnits(total, size).reduce((a, b) => a + b, 0), total)
  }
})

test('effectiveLots: sin dividir es un lote con todo el total', () => {
  assert.deepEqual(effectiveLots('100', []), ['100'])
  assert.deepEqual(effectiveLots('100', ['60', '40']), ['60', '40'])
  assert.deepEqual(effectiveLots('', []), [])
})

test('takenByOthers excluye la propia fila y los vacíos', () => {
  const rows = [row('1', '5'), row('2', '5'), emptySizeRow()]
  assert.deepEqual([...takenByOthers(rows, 0)], ['2'])
  assert.deepEqual([...takenByOthers(rows, 2)].sort(), ['1', '2'])
})

test('sizeProblems: sin filas está bien (las tallas son opcionales)', () => {
  assert.equal(sizeProblems([], 50).valid, true)
})

test('sizeProblems: filas que suman justo el lote', () => {
  const check = sizeProblems([row('1', '30'), row('2', '20')], 50)
  assert.deepEqual([check.valid, check.assigned, check.difference, check.general], [true, 50, 0, []])
})

test('sizeProblems avisa cuántas faltan o sobran', () => {
  assert.deepEqual(sizeProblems([row('1', '30')], 50).general, ['Faltan 20 prendas para completar el lote.'])
  assert.deepEqual(sizeProblems([row('1', '60')], 50).general, ['Sobran 10 prendas en el lote.'])
  assert.equal(sizeProblems([row('1', '60')], 50).valid, false)
})

test('sizeProblems exige la talla y un entero mayor que cero en cada fila', () => {
  const check = sizeProblems([row('', '5'), row('1', ''), row('2', '0'), row('10', '1.5')], 10)
  assert.deepEqual(check.byRow[0], ['Elige la talla.'])
  assert.deepEqual(check.byRow[1], ['Usa un entero mayor que cero.'])
  assert.deepEqual(check.byRow[2], ['Usa un entero mayor que cero.'])
  assert.deepEqual(check.byRow[3], ['Usa un entero mayor que cero.'])
  assert.equal(check.valid, false)
})

test('sizeProblems detecta tallas repetidas', () => {
  const check = sizeProblems([row('1', '5'), row('1', '5')], 10)
  assert.deepEqual(check.byRow[0], ['Esta talla ya está en el lote.'])
  assert.equal(check.valid, false)
})

test('sizeTotals suma las prendas por talla entre lotes y ordena', () => {
  const totals = sizeTotals([[row('2', '20'), row('1', '10')], [row('1', '5'), row('10', '7'), row('99', '3'), row('2', 'x')]], variantOf)
  assert.deepEqual(totals.map((t) => [t.talla, t.color, t.cantidad]), [['4', 'Negro', 7], ['30', 'Azul', 15], ['32', 'Azul', 20]])
})

test('buildOrderBody: orden sin dividir ni tallas', () => {
  const body = buildOrderBody({ referencia: '1', total: '100', resultado: '9', sizes: [], rowsByLot: [] })
  assert.deepEqual(body, { referencia: 1, cantidad: 100, producto_resultado: 9, lotes: [{ cantidad: 100 }] })
})

test('buildOrderBody: lotes con tallas solo donde se definieron', () => {
  const body = buildOrderBody({
    referencia: '1', total: '100', resultado: '9', sizes: ['60', '40'],
    rowsByLot: [[row('1', '40'), row('2', '20')], []], responsable: '  Marta ', observaciones: ' Urgente ',
  })
  assert.deepEqual(body, {
    referencia: 1, cantidad: 100, producto_resultado: 9, responsable: 'Marta', observaciones: 'Urgente',
    lotes: [{ cantidad: 60, tallas: [{ variante: 1, cantidad: 40 }, { variante: 2, cantidad: 20 }] }, { cantidad: 40 }],
  })
})

test('orderProblems: la orden correcta no tiene problemas', () => {
  assert.deepEqual(orderProblems({ reference: REFERENCE, total: '100', resultado: '9', sizes: ['60', '40'], rowsByLot: [] }), [])
})

test('orderProblems va de lo primero a lo último que falta', () => {
  const base = { reference: REFERENCE, total: '100', resultado: '9', sizes: [], rowsByLot: [] }
  assert.deepEqual(orderProblems({ ...base, reference: undefined }), ['Elige la referencia.'])
  assert.deepEqual(orderProblems({ ...base, reference: { tiene_ficha: false } }), ['La referencia no tiene ficha técnica.'])
  assert.deepEqual(orderProblems({ ...base, total: '' }), ['Indica cuántas prendas se van a producir.'])
  assert.deepEqual(orderProblems({ ...base, total: '100001' }), ['Máximo 100000 prendas.'])
  assert.match(orderProblems({ ...base, sizes: ['60', '30'] })[0], /Faltan 10/)
  assert.deepEqual(orderProblems({ ...base, resultado: '' }), ['Elige el pantalón genérico que se producirá.'])
})

test('orderProblems revisa las tallas de cada lote, incluido el lote único', () => {
  const base = { reference: REFERENCE, total: '100', resultado: '9', sizes: ['60', '40'] }
  assert.deepEqual(orderProblems({ ...base, rowsByLot: [[], [row('1', '30')]] }), ['Revisa las tallas del lote 2.'])
  assert.deepEqual(orderProblems({ ...base, rowsByLot: [[], [row('1', '40')]] }), [])
  assert.deepEqual(orderProblems({ ...base, sizes: [], rowsByLot: [[row('1', '50')]] }), ['Revisa las tallas del lote 1.'])
})
