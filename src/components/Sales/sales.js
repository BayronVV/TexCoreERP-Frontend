// Ventas y facturación (HU 7.1): lógica pura de la pantalla de venta, sin React ni DOM, para probarla con `node --test`. El servidor
// es quien decide (stock, precios, tope de descuento, piso del costo de fábrica, montos y numeración); aquí se calcula lo mismo para
// mostrar los totales en vivo y avisar antes de enviar, y debe dar exactamente lo que devuelve el servidor.

export const INVOICE_NOTICE = 'Factura POS interna. No es factura electrónica.'

const isWhole = (text, minimum = 0) => /^\d+$/.test(String(text ?? '').trim()) && Number(String(text).trim()) >= minimum

/** Cociente entero redondeado con la mitad hacia arriba (números positivos): la misma regla del servidor. */
export const roundHalfUp = (numerator, denominator) => Math.floor((2 * numerator + denominator) / (2 * denominator))

/** Pesos con punto de miles: 1234567 → «$1.234.567». */
export const money = (value) => `$${String(Math.round(Number(value) || 0)).replace(/\B(?=(\d{3})+(?!\d))/g, '.')}`

/** Montos de una línea en pesos enteros: subtotal, descuento, base, IVA y total. */
export function lineAmounts(unitPrice, quantity, discountPct, ivaRate = 19) {
  const subtotal = unitPrice * quantity
  const discount = roundHalfUp(subtotal * discountPct, 100)
  const base = subtotal - discount
  const iva = roundHalfUp(base * ivaRate, 100)
  return { subtotal, descuento: discount, base, iva, total: base + iva }
}

/** Precio de lista que corresponde al tipo de cliente (`meta` es `/api/ventas/metadatos/`); `null` si no hay precio. */
export function unitPriceFor(price, clientType, meta) {
  if (!price || price.precio_detal == null) return null
  const list = (meta?.tipos_cliente ?? []).find((item) => item.codigo === clientType)?.lista_precios ?? 'detal'
  return list === 'detal' ? price.precio_detal : price.precio_mayorista
}

/** Descuento máximo (%) que se le puede dar a ese tipo de cliente. */
export const maxDiscountFor = (clientType, meta) => (meta?.tipos_cliente ?? []).find((item) => item.codigo === clientType)?.descuento_maximo ?? 0

/** Las variantes de las existencias indexadas por id: `{ id: { id, referencia, codigo, nombre, talla, color, disponible } }`. */
export function variantIndex(references) {
  const index = {}
  for (const reference of references ?? []) {
    for (const row of reference.colores ?? []) {
      for (const [talla, cell] of Object.entries(row.tallas)) {
        index[cell.variante] = { id: cell.variante, referencia: reference.referencia, codigo: reference.codigo, nombre: reference.nombre, talla, color: row.color, disponible: cell.cantidad }
      }
    }
  }
  return index
}

const rowName = (info) => `${info.codigo} ${info.talla} ${info.color}`

/**
 * Las líneas del carrito (`cart` es `{ idVariante: { cantidad, descuento } }` con textos) ya calculadas. Cada una trae sus
 * `problemas`: cantidad mal escrita, más de lo que hay, sin precio, descuento fuera del tope o precio bajo el costo de fábrica.
 */
export function cartRows({ cart, index, prices, client, meta }) {
  const rows = []
  for (const [id, entry] of Object.entries(cart ?? {})) {
    const info = index?.[id]
    const text = String(entry?.cantidad ?? '').trim()
    if (!info || text === '' || text === '0') continue
    const price = prices?.[info.referencia]
    const unit = client ? unitPriceFor(price, client.tipo, meta) : null
    const quantity = isWhole(text, 1) ? Number(text) : null
    const discountText = String(entry?.descuento ?? '').trim()
    const discount = discountText === '' ? 0 : isWhole(discountText, 0) && Number(discountText) <= 100 ? Number(discountText) : null
    const problems = []
    if (quantity === null) problems.push(`${rowName(info)}: la cantidad debe ser un entero mayor que cero.`)
    else if (quantity > info.disponible) problems.push(`${rowName(info)}: hay ${info.disponible} y pides ${quantity}.`)
    if (discount === null) problems.push(`${rowName(info)}: el descuento debe ser un entero entre 0 y 100.`)
    if (price?.precio_detal == null) problems.push(`${rowName(info)}: la referencia no tiene precio de venta; pídele al Gerente que lo registre.`)
    else if (client && discount !== null) {
      const cap = maxDiscountFor(client.tipo, meta)
      if (discount > cap) problems.push(`${rowName(info)}: el descuento máximo para este cliente es ${cap} %.`)
      else if (unit * (100 - discount) < price.costo_fabrica * 100) problems.push(`${rowName(info)}: con ${discount} % el precio queda por debajo del costo de fábrica (${money(price.costo_fabrica)}).`)
    }
    const valid = quantity !== null && discount !== null && unit !== null
    rows.push({
      ...info, variante: info.id, cantidad: quantity, textoCantidad: text, descuento: discount, textoDescuento: discountText, precio: unit,
      costo: price?.costo_fabrica ?? null, montos: valid ? lineAmounts(unit, quantity, discount, meta?.iva_tarifa ?? 19) : null, problemas: problems,
    })
  }
  return rows.sort((a, b) => a.referencia - b.referencia || a.id - b.id)
}

/** Totales de la factura: la suma de sus líneas (las que no se pueden calcular no cuentan). */
export function cartTotals(rows) {
  const totals = { subtotal: 0, descuento: 0, base: 0, iva: 0, total: 0, unidades: 0 }
  for (const row of rows) {
    if (!row.montos) continue
    for (const key of ['subtotal', 'descuento', 'base', 'iva', 'total']) totals[key] += row.montos[key]
    totals.unidades += row.cantidad
  }
  return totals
}

/** Motivos por los que todavía no se puede facturar (vacío si está listo). */
export function saleProblems({ client, rows }) {
  const problems = []
  if (!client) problems.push('Elige el cliente.')
  if (!rows.length) problems.push('Agrega al menos una prenda a la venta.')
  for (const row of rows) problems.push(...row.problemas)
  return problems
}

/** Cuerpo del POST: el cliente, las líneas con su descuento y el token único del formulario. */
export function saleBody({ client, rows, transportadora, numeroGuia, observaciones, token }) {
  return {
    cliente: client.id,
    token,
    lineas: rows.map((row) => ({ variante: row.variante, cantidad: row.cantidad, descuento_pct: row.descuento })),
    transportadora: transportadora ?? '',
    numero_guia: (numeroGuia ?? '').trim(),
    observaciones: (observaciones ?? '').trim(),
  }
}

/** Texto de la confirmación previa: no se puede editar y descuenta el inventario. */
export function saleConfirmation(rows, totals, client) {
  const detail = rows.map((row) => `${row.codigo} ${row.talla} · ${row.color}: ${row.cantidad} × ${money(row.precio)}${row.descuento ? ` (−${row.descuento} %)` : ''}`).join('\n')
  return `Vas a facturar a ${client.nombre}:\n\n${detail}\n\nTotal a pagar contraentrega: ${money(totals.total)} (IVA incluido). ` +
    'Se descuenta el inventario y la factura no se puede editar: si hay un error se anula. ¿Facturar?'
}

/** Resumen del panel de ventas con las facturas de hoy: emitidas, anuladas, vendido y por cobrar. */
export function dayResume(invoices, today) {
  const issued = (invoices ?? []).filter((invoice) => invoice.estado === 'EMITIDA')
  const ofToday = issued.filter((invoice) => invoice.fecha === today)
  const sum = (list) => list.reduce((total, invoice) => total + invoice.total, 0)
  return {
    emitidasHoy: ofToday.length,
    vendidoHoy: sum(ofToday),
    anuladasHoy: (invoices ?? []).filter((invoice) => invoice.estado === 'ANULADA' && invoice.fecha === today).length,
    porCobrar: sum(issued.filter((invoice) => invoice.estado_cobro === 'POR_COBRAR')),
    facturasPorCobrar: issued.filter((invoice) => invoice.estado_cobro === 'POR_COBRAR').length,
  }
}

/** Margen sobre el precio de venta (%) con un decimal; «—» si no hay precio. */
export const marginLabel = (price, cost) => (price && cost ? `${(((price - cost) / price) * 100).toFixed(1).replace('.', ',')} %` : '—')
