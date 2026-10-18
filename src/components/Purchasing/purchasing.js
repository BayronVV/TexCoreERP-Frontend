// Órdenes de compra y recepción de mercancía: lógica pura de los formularios, sin React ni DOM, para probarla con
// `node --test`. El servidor valida todo (estados, tolerancia, permisos); aquí solo se ofrece lo que tiene sentido y se avisa
// antes de enviar.
import { WHOLE_UNITS } from '../Inventory/labels.js'
import { costError } from '../Inventory/money.js'

/** Tipos de producto que se compran a un proveedor. */
export const PURCHASABLE = ['MATERIA_PRIMA', 'INSUMO']
export const purchasableProducts = (products) => (products ?? []).filter((product) => PURCHASABLE.includes(product.tipo))

/** Color de la insignia de cada estado de la orden (nombres de las insignias de `Inventory.module.css`). */
export const STATE_TONE = {
  BORRADOR: 'badgeOff', APROBADA: 'badgeInfo', RECIBIDA_PARCIAL: 'badgeWarn', RECIBIDA: 'badgeOk', CERRADA: 'badgeOff', CANCELADA: 'badgeDanger',
}

const isPositive = (text) => Number(text) > 0
const isWhole = (text) => /^\d+$/.test(String(text).trim())
const isAmount = (text) => /^\d+(\.\d{1,2})?$/.test(String(text).trim())

/** Problema de una cantidad escrita (`''` si está bien): mayor que cero, entera en unidades que no admiten decimales. */
export function quantityError(text, unit) {
  const value = String(text ?? '').trim()
  if (!value || !isPositive(value)) return 'La cantidad debe ser mayor que cero.'
  if (WHOLE_UNITS.includes(unit)) return isWhole(value) ? '' : 'Esta unidad no admite decimales.'
  return isAmount(value) ? '' : 'Usa hasta 2 decimales, con punto.'
}

// --- Orden de compra ---

export const emptyOrderForm = () => ({ proveedor: '', fecha_esperada: '', condiciones_pago: '', notas: '' })

/** Formulario de una orden existente, con textos vacíos en lugar de `null`. */
export const orderForm = (order) => ({
  proveedor: String(order.proveedor), fecha_esperada: order.fecha_esperada ?? '', condiciones_pago: order.condiciones_pago ?? '', notas: order.notas ?? '',
})

/** Líneas de una orden existente como filas editables `{producto, nombre, unidad, cantidad, precio}`. */
export const orderLinesOf = (order) =>
  order.lineas.map((line) => ({
    producto: line.producto, nombre: line.producto_nombre, unidad: line.unidad, cantidad: String(Number(line.cantidad_pedida)),
    precio: line.precio_pactado === null ? '' : String(Number(line.precio_pactado)),
  }))

/**
 * Agrega un material a las líneas de la orden. Devuelve `{ lines }` o `{ error }`; un producto no se repite (se suman cantidades
 * en una sola línea) y el precio pactado es opcional.
 */
export function addLine(lines, product, quantity, price) {
  if (!product) return { error: 'Elige el material.' }
  if (lines.some((line) => line.producto === product.id)) return { error: `${product.nombre} ya está en la orden: cambia su cantidad.` }
  const problem = quantityError(quantity, product.unidad)
  if (problem) return { error: problem }
  const priceProblem = String(price ?? '').trim() ? costError(price) : ''
  if (priceProblem) return { error: priceProblem }
  return { lines: [...lines, { producto: product.id, nombre: product.nombre, unidad: product.unidad, cantidad: String(quantity).trim(), precio: String(price ?? '').trim() }] }
}

export const removeLine = (lines, productId) => lines.filter((line) => line.producto !== productId)

/** Valor de una línea (cantidad × precio pactado), o `null` si no tiene precio. */
export function lineValue(line) {
  const price = String(line.precio ?? '').trim()
  return price === '' ? null : Math.round(Number(line.cantidad) * Number(price) * 100) / 100
}

/** Valor estimado de la orden y cuántas líneas no tienen precio (no suman). */
export function orderValue(lines) {
  let total = 0
  let withoutPrice = 0
  for (const line of lines) {
    const value = lineValue(line)
    if (value === null) withoutPrice += 1
    else total += value
  }
  return { total: Math.round(total * 100) / 100, withoutPrice }
}

/** Motivos por los que todavía no se puede guardar la orden (vacío si está lista). */
export function orderProblems(form, lines) {
  const problems = []
  if (!form.proveedor) problems.push('Elige el proveedor.')
  if (lines.length === 0) problems.push('Agrega al menos un material.')
  return problems
}

/** Cuerpo del POST/PATCH de la orden. El precio vacío viaja como `null`. */
export function orderBody(form, lines) {
  return {
    proveedor: Number(form.proveedor),
    fecha_esperada: form.fecha_esperada || null,
    condiciones_pago: form.condiciones_pago.trim(),
    notas: form.notas.trim(),
    lineas: lines.map((line) => ({
      producto: line.producto, cantidad: String(line.cantidad).trim(), precio_pactado: String(line.precio ?? '').trim() || null,
    })),
  }
}

/** Avance de recepción: líneas completas, total y porcentaje promedio (cada línea cuenta lo mismo, tope 100 %). */
export function orderProgress(order) {
  const lines = order.lineas ?? []
  if (lines.length === 0) return { complete: 0, total: 0, percent: 0 }
  const ratios = lines.map((line) => Math.min(Number(line.cantidad_recibida) / Number(line.cantidad_pedida), 1))
  return {
    complete: lines.filter((line) => line.completa).length, total: lines.length,
    percent: Math.round((ratios.reduce((sum, ratio) => sum + ratio, 0) / lines.length) * 100),
  }
}

/** Qué botones ofrece la orden según su estado y los permisos del usuario (`can('compras.aprobar')`...). El servidor valida igual. */
export function allowedActions(order, can) {
  const manage = can('compras.gestionar')
  return {
    edit: order.estado === 'BORRADOR' && manage,
    approve: order.estado === 'BORRADOR' && can('compras.aprobar'),
    cancel: (order.estado === 'BORRADOR' || order.estado === 'APROBADA') && manage,
    close: order.estado === 'RECIBIDA_PARCIAL' && manage,
    receive: Boolean(order.recibible) && can('inventario.gestionar'),
  }
}

// --- Recepción de mercancía ---

/** Filas de recepción de una orden: una por línea con algo por recibir. La cantidad sugerida es lo pendiente y el costo, el precio pactado. */
export function receiptRowsFor(order) {
  return (order.lineas ?? [])
    .filter((line) => Number(line.maximo_a_recibir) > 0)
    .map((line) => ({
      linea: line.id, producto: line.producto, nombre: line.producto_nombre, unidad: line.unidad, pendiente: line.pendiente,
      maximo: line.maximo_a_recibir, cantidad: String(Number(line.pendiente)), lote: '',
      costo: line.precio_pactado === null ? '' : String(Number(line.precio_pactado)),
    }))
}

/** Fila nueva de una recepción suelta (sin orden). */
export const looseRow = (product) => ({ producto: product.id, nombre: product.nombre, unidad: product.unidad, cantidad: '', lote: '', costo: '' })

/** ¿La fila trae cantidad? Las filas en blanco o en cero no se envían (la línea simplemente no llegó). */
export const hasQuantity = (row) => Number(String(row.cantidad ?? '').trim()) > 0

/** Problema de una fila de recepción (`''` si está bien o si no trae cantidad). Con orden, no puede pasar del máximo permitido. */
export function receiptRowProblem(row) {
  if (!hasQuantity(row)) return ''
  const problem = quantityError(row.cantidad, row.unidad)
  if (problem) return problem
  if (row.maximo !== undefined && Number(row.cantidad) > Number(row.maximo)) return `Máximo ${Number(row.maximo)} (lo pendiente más la tolerancia).`
  if (!String(row.lote ?? '').trim()) return 'Escribe el lote.'
  const cost = String(row.costo ?? '').trim()
  return cost ? costError(cost) : ''
}

/** Motivos por los que todavía no se puede registrar la recepción (vacío si está lista). */
export function receiptProblems({ rows, documento, supplier, withOrder }) {
  const problems = []
  if (!String(documento ?? '').trim()) problems.push('Escribe el número de la remisión o la factura.')
  if (!withOrder && !supplier) problems.push('Elige el proveedor.')
  if (!rows.some(hasQuantity)) problems.push('Indica cuánto llegó de al menos un producto.')
  if (rows.some((row) => receiptRowProblem(row))) problems.push('Revisa las filas marcadas.')
  return problems
}

/** Cuerpo del POST de una recepción: con orden va la línea de la orden; suelta, el producto y el proveedor. */
export function receiptBody({ order, supplier, rows, documento, fecha, observaciones }) {
  return {
    ...(order ? { orden: order.id } : { proveedor: Number(supplier) }),
    documento: documento.trim(),
    fecha: fecha || null,
    observaciones: (observaciones ?? '').trim(),
    lineas: rows.filter(hasQuantity).map((row) => ({
      ...(order ? { linea: row.linea } : { producto: row.producto }),
      cantidad: String(row.cantidad).trim(), lote: row.lote.trim(), costo_unitario: String(row.costo ?? '').trim() || null,
    })),
  }
}
