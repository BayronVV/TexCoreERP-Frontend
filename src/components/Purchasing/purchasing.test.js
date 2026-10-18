import test from 'node:test'
import assert from 'node:assert/strict'

import {
  addLine,
  allowedActions,
  emptyOrderForm,
  hasQuantity,
  lineValue,
  looseRow,
  orderBody,
  orderForm,
  orderLinesOf,
  orderProblems,
  orderProgress,
  orderValue,
  purchasableProducts,
  quantityError,
  receiptBody,
  receiptProblems,
  receiptRowProblem,
  receiptRowsFor,
  removeLine,
} from './purchasing.js'

const tela = { id: 1, nombre: 'Tela denim', unidad: 'm', tipo: 'MATERIA_PRIMA' }
const cierre = { id: 2, nombre: 'Cierre', unidad: 'unidad', tipo: 'INSUMO' }
const generico = { id: 3, nombre: 'Pantalón genérico', unidad: 'unidad', tipo: 'GENERICO' }

const order = (overrides = {}) => ({
  id: 7, proveedor: 4, estado: 'APROBADA', recibible: true, fecha_esperada: null, condiciones_pago: '', notas: '',
  lineas: [
    { id: 11, producto: 1, producto_nombre: 'Tela denim', unidad: 'm', cantidad_pedida: '100.00', precio_pactado: '18500.0000', cantidad_recibida: '60.00', pendiente: '40.00', maximo_a_recibir: '42.00', completa: false },
    { id: 12, producto: 2, producto_nombre: 'Cierre', unidad: 'unidad', cantidad_pedida: '50.00', precio_pactado: null, cantidad_recibida: '50.00', pendiente: '0.00', maximo_a_recibir: '0.00', completa: true },
  ],
  ...overrides,
})

test('purchasableProducts: solo materia prima e insumos', () => {
  assert.deepEqual(purchasableProducts([tela, cierre, generico]).map((p) => p.id), [1, 2])
  assert.deepEqual(purchasableProducts(undefined), [])
})

test('quantityError: mayor que cero, entera si la unidad no admite decimales', () => {
  assert.equal(quantityError('10', 'm'), '')
  assert.equal(quantityError('10.5', 'm'), '')
  assert.ok(quantityError('10.555', 'm'))
  assert.ok(quantityError('0', 'm'))
  assert.ok(quantityError('', 'm'))
  assert.ok(quantityError('abc', 'm'))
  assert.equal(quantityError('12', 'unidad'), '')
  assert.ok(quantityError('2.5', 'unidad'))
  assert.ok(quantityError('2.5', 'caja'))
})

test('addLine: agrega con precio opcional y valida', () => {
  const first = addLine([], tela, '100', '18500')
  assert.deepEqual(first.lines, [{ producto: 1, nombre: 'Tela denim', unidad: 'm', cantidad: '100', precio: '18500' }])
  assert.equal(addLine(first.lines, cierre, '50', '').lines.length, 2) // sin precio
  assert.ok(addLine(first.lines, tela, '5', '').error.includes('ya está en la orden'))
  assert.ok(addLine([], null, '5', '').error)
  assert.ok(addLine([], cierre, '2.5', '').error)
  assert.ok(addLine([], tela, '0', '').error)
  assert.ok(addLine([], tela, '5', '-3').error)
  assert.ok(addLine([], tela, '5', '1.123456').error)
})

test('removeLine, lineValue y orderValue', () => {
  const lines = [
    { producto: 1, cantidad: '100', precio: '18500' },
    { producto: 2, cantidad: '50', precio: '' },
    { producto: 4, cantidad: '2.5', precio: '10.5' },
  ]
  assert.deepEqual(removeLine(lines, 2).map((l) => l.producto), [1, 4])
  assert.equal(lineValue(lines[0]), 1850000)
  assert.equal(lineValue(lines[1]), null)
  assert.equal(lineValue(lines[2]), 26.25)
  assert.deepEqual(orderValue(lines), { total: 1850026.25, withoutPrice: 1 })
  assert.deepEqual(orderValue([]), { total: 0, withoutPrice: 0 })
})

test('orderProblems y orderBody', () => {
  assert.deepEqual(orderProblems(emptyOrderForm(), []), ['Elige el proveedor.', 'Agrega al menos un material.'])
  const form = { ...emptyOrderForm(), proveedor: '4', condiciones_pago: ' 30 días ', fecha_esperada: '' }
  const lines = [{ producto: 1, cantidad: ' 100 ', precio: '' }, { producto: 2, cantidad: '5', precio: '90' }]
  assert.deepEqual(orderProblems(form, lines), [])
  assert.deepEqual(orderBody(form, lines), {
    proveedor: 4, fecha_esperada: null, condiciones_pago: '30 días', notas: '',
    lineas: [{ producto: 1, cantidad: '100', precio_pactado: null }, { producto: 2, cantidad: '5', precio_pactado: '90' }],
  })
})

test('orderForm y orderLinesOf: parten de una orden existente', () => {
  const existing = order({ fecha_esperada: '2026-11-01', condiciones_pago: 'Contado', notas: null })
  assert.deepEqual(orderForm(existing), { proveedor: '4', fecha_esperada: '2026-11-01', condiciones_pago: 'Contado', notas: '' })
  assert.deepEqual(orderLinesOf(existing)[0], { producto: 1, nombre: 'Tela denim', unidad: 'm', cantidad: '100', precio: '18500' })
  assert.equal(orderLinesOf(existing)[1].precio, '')
})

test('orderProgress: líneas completas y porcentaje promedio con tope de 100 %', () => {
  assert.deepEqual(orderProgress(order()), { complete: 1, total: 2, percent: 80 }) // (60 % + 100 %) / 2
  assert.deepEqual(orderProgress({ lineas: [] }), { complete: 0, total: 0, percent: 0 })
  const over = order({ lineas: [{ ...order().lineas[0], cantidad_recibida: '105.00', completa: true }] })
  assert.equal(orderProgress(over).percent, 100)
})

test('allowedActions: según el estado y los permisos', () => {
  const grants = (...codes) => (code) => codes.includes(code)
  const producer = grants('compras.ver', 'compras.gestionar')
  const manager = grants('compras.ver', 'compras.aprobar')
  const store = grants('compras.ver', 'inventario.gestionar')
  const draft = order({ estado: 'BORRADOR', recibible: false })
  assert.deepEqual(allowedActions(draft, producer), { edit: true, approve: false, cancel: true, close: false, receive: false })
  assert.deepEqual(allowedActions(draft, manager), { edit: false, approve: true, cancel: false, close: false, receive: false })
  assert.deepEqual(allowedActions(order(), store), { edit: false, approve: false, cancel: false, close: false, receive: true })
  assert.deepEqual(allowedActions(order(), producer), { edit: false, approve: false, cancel: true, close: false, receive: false })
  const partial = order({ estado: 'RECIBIDA_PARCIAL' })
  assert.equal(allowedActions(partial, producer).close, true)
  assert.equal(allowedActions(partial, producer).cancel, false)
  const done = order({ estado: 'RECIBIDA', recibible: false })
  assert.deepEqual(allowedActions(done, grants('compras.gestionar', 'compras.aprobar', 'inventario.gestionar')),
    { edit: false, approve: false, cancel: false, close: false, receive: false })
})

test('receiptRowsFor: una fila por línea con algo por recibir, con lo pendiente y el precio sugeridos', () => {
  const rows = receiptRowsFor(order())
  assert.equal(rows.length, 1) // el cierre ya está completo
  assert.deepEqual(rows[0], {
    linea: 11, producto: 1, nombre: 'Tela denim', unidad: 'm', pendiente: '40.00', maximo: '42.00', cantidad: '40', lote: '', costo: '18500',
  })
  assert.deepEqual(receiptRowsFor({ lineas: [] }), [])
})

test('receiptRowProblem: máximo, lote y costo; una fila sin cantidad no se valida', () => {
  const row = { ...receiptRowsFor(order())[0], lote: 'L-1' }
  assert.equal(receiptRowProblem(row), '')
  assert.ok(receiptRowProblem({ ...row, cantidad: '42.01' }).includes('Máximo 42'))
  assert.equal(receiptRowProblem({ ...row, cantidad: '42' }), '')
  assert.ok(receiptRowProblem({ ...row, lote: '  ' }).includes('lote'))
  assert.ok(receiptRowProblem({ ...row, costo: '-1' }))
  assert.equal(receiptRowProblem({ ...row, costo: '' }), '')
  assert.equal(receiptRowProblem({ ...row, cantidad: '', lote: '' }), '') // no llegó: se omite
  assert.equal(receiptRowProblem({ ...row, cantidad: '0', lote: '' }), '')
  assert.ok(receiptRowProblem({ producto: 2, unidad: 'unidad', cantidad: '2.5', lote: 'L', costo: '' }).includes('decimales'))
  assert.equal(receiptRowProblem({ producto: 2, unidad: 'unidad', cantidad: '500', lote: 'L', costo: '' }), '') // suelta: sin máximo
})

test('hasQuantity', () => {
  assert.equal(hasQuantity({ cantidad: '5' }), true)
  assert.equal(hasQuantity({ cantidad: '0' }), false)
  assert.equal(hasQuantity({ cantidad: '' }), false)
  assert.equal(hasQuantity({ cantidad: undefined }), false)
})

test('receiptProblems: documento, proveedor (suelta) y al menos una fila con cantidad', () => {
  const rows = [{ ...receiptRowsFor(order())[0], lote: 'L-1' }]
  assert.deepEqual(receiptProblems({ rows, documento: 'REM-1', withOrder: true }), [])
  assert.deepEqual(receiptProblems({ rows, documento: '  ', withOrder: true }), ['Escribe el número de la remisión o la factura.'])
  assert.deepEqual(receiptProblems({ rows, documento: 'F', supplier: '', withOrder: false }), ['Elige el proveedor.'])
  assert.deepEqual(receiptProblems({ rows: [{ ...rows[0], cantidad: '' }], documento: 'F', withOrder: true }), ['Indica cuánto llegó de al menos un producto.'])
  assert.deepEqual(receiptProblems({ rows: [{ ...rows[0], lote: '' }], documento: 'F', withOrder: true }), ['Revisa las filas marcadas.'])
})

test('receiptBody: con orden lleva la línea; suelta, el producto y el proveedor; omite filas sin cantidad', () => {
  const rows = [
    { ...receiptRowsFor(order())[0], lote: ' L-1 ', costo: '18000' },
    { linea: 12, producto: 2, unidad: 'unidad', cantidad: '', lote: '', costo: '' },
  ]
  assert.deepEqual(receiptBody({ order: order(), rows, documento: ' REM-9 ', fecha: '', observaciones: ' ok ' }), {
    orden: 7, documento: 'REM-9', fecha: null, observaciones: 'ok', lineas: [{ linea: 11, cantidad: '40', lote: 'L-1', costo_unitario: '18000' }],
  })
  const loose = [{ ...looseRow(tela), cantidad: '20', lote: 'L-2', costo: '' }, looseRow(cierre)]
  assert.deepEqual(receiptBody({ supplier: '4', rows: loose, documento: 'FAC-1', fecha: '2026-10-18' }), {
    proveedor: 4, documento: 'FAC-1', fecha: '2026-10-18', observaciones: '', lineas: [{ producto: 1, cantidad: '20', lote: 'L-2', costo_unitario: null }],
  })
})
