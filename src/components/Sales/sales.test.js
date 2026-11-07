import test from 'node:test'
import assert from 'node:assert/strict'

import {
  canReconcile,
  cartRows,
  cartTotals,
  carteraResume,
  dayResume,
  filterCartera,
  lineAmounts,
  marginLabel,
  maxDiscountFor,
  money,
  roundHalfUp,
  saleBody,
  saleConfirmation,
  saleProblems,
  unitPriceFor,
  variantIndex,
} from './sales.js'

const meta = {
  iva_tarifa: 19,
  tipos_cliente: [
    { codigo: 'DETAL', lista_precios: 'detal', descuento_maximo: 5 },
    { codigo: 'MAYORISTA', lista_precios: 'mayorista', descuento_maximo: 15 },
    { codigo: 'DISTRIBUIDOR', lista_precios: 'mayorista', descuento_maximo: 20 },
  ],
}
const references = [{
  referencia: 1, codigo: 'REF-0012', nombre: 'Slim blanco roto', tallas: ['30', '32'],
  colores: [
    { color: 'Blanco', tallas: { 30: { variante: 11, cantidad: 20 }, 32: { variante: 12, cantidad: 3 } }, total: 23 },
    { color: 'Negro', tallas: { 30: { variante: 13, cantidad: 0 } }, total: 0 },
  ],
}]
const index = variantIndex(references)
const prices = { 1: { costo_fabrica: 47000, precio_mayorista: 68000, precio_detal: 89900 } }
const wholesale = { id: 5, nombre: 'Moda Joven', tipo: 'MAYORISTA' }
const retail = { id: 6, nombre: 'Carolina', tipo: 'DETAL' }
const rowsOf = (cart, client = wholesale) => cartRows({ cart, index, prices, client, meta })

test('roundHalfUp, money y marginLabel', () => {
  assert.deepEqual([roundHalfUp(5, 2), roundHalfUp(1, 3), roundHalfUp(7, 2), roundHalfUp(4, 2), roundHalfUp(0, 5)], [3, 0, 4, 2, 0])
  assert.equal(money(1234567), '$1.234.567')
  assert.equal(money(950), '$950')
  assert.equal(money(0), '$0')
  assert.equal(marginLabel(68000, 47000), '30,9 %')
  assert.equal(marginLabel(null, 47000), '—')
})

test('lineAmounts: los mismos montos que el servidor', () => {
  assert.deepEqual(lineAmounts(68000, 2, 10), { subtotal: 136000, descuento: 13600, base: 122400, iva: 23256, total: 145656 })
  assert.deepEqual(lineAmounts(89900, 1, 0), { subtotal: 89900, descuento: 0, base: 89900, iva: 17081, total: 106981 })
  for (const price of [33333, 68000, 99999]) {
    for (const discount of [0, 3, 7, 15, 20]) {
      const amounts = lineAmounts(price, 3, discount)
      assert.equal(amounts.base, amounts.subtotal - amounts.descuento)
      assert.equal(amounts.total, amounts.base + amounts.iva)
    }
  }
})

test('unitPriceFor y maxDiscountFor según el tipo de cliente', () => {
  assert.equal(unitPriceFor(prices[1], 'DETAL', meta), 89900)
  assert.equal(unitPriceFor(prices[1], 'MAYORISTA', meta), 68000)
  assert.equal(unitPriceFor(prices[1], 'DISTRIBUIDOR', meta), 68000)
  assert.equal(unitPriceFor({ precio_detal: null }, 'DETAL', meta), null)
  assert.deepEqual(['DETAL', 'MAYORISTA', 'DISTRIBUIDOR', 'X'].map((type) => maxDiscountFor(type, meta)), [5, 15, 20, 0])
})

test('variantIndex: cada celda de las existencias con su disponibilidad', () => {
  assert.deepEqual(index[12], { id: 12, referencia: 1, codigo: 'REF-0012', nombre: 'Slim blanco roto', talla: '32', color: 'Blanco', disponible: 3 })
  assert.equal(Object.keys(index).length, 3)
  assert.deepEqual(variantIndex(undefined), {})
})

test('cartRows: calcula cada línea y solo incluye las que tienen cantidad', () => {
  const rows = rowsOf({ 11: { cantidad: '2', descuento: '10' }, 12: { cantidad: '', descuento: '' }, 13: { cantidad: '0' } })
  assert.equal(rows.length, 1)
  assert.deepEqual([rows[0].variante, rows[0].cantidad, rows[0].precio, rows[0].descuento], [11, 2, 68000, 10])
  assert.deepEqual(rows[0].montos, { subtotal: 136000, descuento: 13600, base: 122400, iva: 23256, total: 145656 })
  assert.deepEqual(rows[0].problemas, [])
  assert.equal(rowsOf({ 11: { cantidad: '1' } }, retail)[0].precio, 89900) // el detal paga el precio de detal
})

test('cartRows: los problemas de cada línea', () => {
  const problem = (entry, client = wholesale) => rowsOf({ 11: entry }, client)[0].problemas[0] ?? ''
  assert.ok(problem({ cantidad: '2.5' }).includes('entero'))
  assert.ok(rowsOf({ 12: { cantidad: '4' } })[0].problemas[0].includes('hay 3 y pides 4'))
  assert.ok(problem({ cantidad: '1', descuento: '16' }).includes('máximo para este cliente es 15 %'))
  assert.ok(problem({ cantidad: '1', descuento: '6' }, retail).includes('máximo para este cliente es 5 %'))
  assert.ok(problem({ cantidad: '1', descuento: 'x' }).includes('entre 0 y 100'))
  assert.equal(problem({ cantidad: '1', descuento: '15' }), '') // el tope exacto se permite
})

test('cartRows: precio bajo el costo de fábrica y referencia sin precio', () => {
  const near = { 1: { costo_fabrica: 47000, precio_mayorista: 50000, precio_detal: 89900 } }
  const build = (discount) => cartRows({ cart: { 11: { cantidad: '1', descuento: discount } }, index, prices: near, client: wholesale, meta })[0]
  assert.deepEqual(build('6').problemas, []) // 50.000 × 0,94 = 47.000: el costo exacto se permite
  assert.ok(build('7').problemas[0].includes('por debajo del costo de fábrica ($47.000)'))
  const none = cartRows({ cart: { 11: { cantidad: '1' } }, index, prices: {}, client: wholesale, meta })[0]
  assert.ok(none.problemas[0].includes('no tiene precio de venta'))
  assert.equal(none.montos, null)
})

test('cartTotals: la suma de las líneas y solo de las calculables', () => {
  const rows = rowsOf({ 11: { cantidad: '3', descuento: '5' }, 12: { cantidad: '1', descuento: '15' }, 13: { cantidad: 'x' } })
  const totals = cartTotals(rows)
  assert.equal(totals.unidades, 4)
  for (const key of ['subtotal', 'descuento', 'base', 'iva', 'total']) assert.equal(totals[key], rows.filter((row) => row.montos).reduce((sum, row) => sum + row.montos[key], 0))
  assert.equal(totals.total, totals.base + totals.iva)
})

test('saleProblems: cliente, carrito vacío y los de cada línea', () => {
  assert.deepEqual(saleProblems({ client: null, rows: [] }), ['Elige el cliente.', 'Agrega al menos una prenda a la venta.'])
  assert.deepEqual(saleProblems({ client: wholesale, rows: rowsOf({ 11: { cantidad: '2' } }) }), [])
  assert.equal(saleProblems({ client: wholesale, rows: rowsOf({ 12: { cantidad: '9' } }) }).length, 1)
})

test('saleBody y saleConfirmation', () => {
  const rows = rowsOf({ 11: { cantidad: '2', descuento: '10' } })
  assert.deepEqual(saleBody({ client: wholesale, rows, transportadora: 'ENVIA', numeroGuia: ' 123 ', observaciones: ' ok ', token: 'abc' }), {
    cliente: 5, token: 'abc', lineas: [{ variante: 11, cantidad: 2, descuento_pct: 10 }], transportadora: 'ENVIA', numero_guia: '123', observaciones: 'ok',
  })
  const text = saleConfirmation(rows, cartTotals(rows), wholesale)
  assert.ok(text.includes('Moda Joven') && text.includes('2 × $68.000 (−10 %)') && text.includes('$145.656') && text.includes('se anula'))
})

test('dayResume: lo emitido hoy, lo anulado y lo que está por cobrar', () => {
  const invoices = [
    { estado: 'EMITIDA', fecha: '2026-11-04', total: 100, estado_cobro: 'POR_COBRAR' },
    { estado: 'EMITIDA', fecha: '2026-11-03', total: 50, estado_cobro: 'POR_COBRAR' },
    { estado: 'ANULADA', fecha: '2026-11-04', total: 70, estado_cobro: 'POR_COBRAR' },
  ]
  assert.deepEqual(dayResume(invoices, '2026-11-04'), { emitidasHoy: 1, vendidoHoy: 100, anuladasHoy: 1, porCobrar: 150, facturasPorCobrar: 2 })
  assert.deepEqual(dayResume(undefined, '2026-11-04'), { emitidasHoy: 0, vendidoHoy: 0, anuladasHoy: 0, porCobrar: 0, facturasPorCobrar: 0 })
})

test('carteraResume: calcula totales por cobrar, pagados y devoluciones', () => {
  const invoices = [
    { estado: 'EMITIDA', estado_cobro: 'POR_COBRAR', valor_a_recaudar: 150000 },
    { estado: 'EMITIDA', estado_cobro: 'POR_COBRAR', valor_a_recaudar: 80000 },
    { estado: 'EMITIDA', estado_cobro: 'PAGADO', valor_a_recaudar: 200000 },
    { estado: 'EMITIDA', estado_cobro: 'DEVOLUCION', valor_a_recaudar: 50000 },
    { estado: 'ANULADA', estado_cobro: 'POR_COBRAR', valor_a_recaudar: 90000 },
  ]
  const kpis = carteraResume(invoices, 500000)
  assert.equal(kpis.saldoFinanciero, 500000)
  assert.equal(kpis.totalPorCobrar, 230000)
  assert.equal(kpis.facturasPorCobrar, 2)
  assert.equal(kpis.totalRecaudado, 200000)
  assert.equal(kpis.facturasPagadas, 1)
  assert.equal(kpis.totalDevoluciones, 50000)
  assert.equal(kpis.facturasDevueltas, 1)
})

test('filterCartera: filtra por pestaña, búsqueda y transportadora', () => {
  const invoices = [
    { numero: 'FV-0001', cliente_nombre: 'Moda Joven', cliente_documento: '901234', transportadora: 'INTERRAPIDISIMO', numero_guia: 'GUI-10', estado_cobro: 'POR_COBRAR' },
    { numero: 'FV-0002', cliente_nombre: 'Carolina Pérez', cliente_documento: '103245', transportadora: 'ENVIA', numero_guia: 'GUI-20', estado_cobro: 'PAGADO' },
    { numero: 'FV-0003', cliente_nombre: 'Boutique La 10', cliente_documento: '900765', transportadora: 'ENVIA', numero_guia: 'GUI-30', estado_cobro: 'DEVOLUCION' },
  ]

  // Por pestaña
  assert.equal(filterCartera(invoices, { tab: 'POR_COBRAR' }).length, 1)
  assert.equal(filterCartera(invoices, { tab: 'PAGADO' })[0].numero, 'FV-0002')
  assert.equal(filterCartera(invoices, { tab: 'TODAS' }).length, 3)

  // Por búsqueda
  assert.equal(filterCartera(invoices, { tab: 'TODAS', search: 'Carolina' }).length, 1)
  assert.equal(filterCartera(invoices, { tab: 'TODAS', search: 'GUI-30' })[0].numero, 'FV-0003')

  // Por transportadora
  assert.equal(filterCartera(invoices, { tab: 'TODAS', carrier: 'ENVIA' }).length, 2)
})

test('canReconcile: solo facturas emitidas en estado por cobrar', () => {
  assert.equal(canReconcile({ estado: 'EMITIDA', estado_cobro: 'POR_COBRAR' }), true)
  assert.equal(canReconcile({ estado: 'EMITIDA', estado_cobro: 'PAGADO' }), false)
  assert.equal(canReconcile({ estado: 'EMITIDA', estado_cobro: 'DEVOLUCION' }), false)
  assert.equal(canReconcile({ estado: 'ANULADA', estado_cobro: 'POR_COBRAR' }), false)
  assert.equal(canReconcile(null), false)
})
