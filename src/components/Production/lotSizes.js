// Lógica pura de la generación de órdenes y lotes (HU 4.2): tallas por lote y cuerpo del POST. Repite las reglas del
// servidor para avisar al instante; el servidor es quien valida y quien descuenta el material.
import { isPositiveInteger } from '../Inventory/orderLines.js'
import { MAX_GARMENTS, MAX_LOTS, lotProblems, lotsSum } from './lotSplit.js'

/** Una fila vacía del editor de tallas de un lote: la variante (talla y color) y cuántas prendas. */
export const emptySizeRow = () => ({ variante: '', cantidad: '' })

/**
 * Reparte `total` prendas en lotes de `perLot` prendas; el último lleva lo que sobre (100 en 30 → 30, 30, 30, 10).
 * Devuelve la lista vacía si no se puede: datos no enteros, o más de `MAX_LOTS` lotes.
 *
 * @param {number|string} total
 * @param {number|string} perLot
 * @returns {number[]}
 */
export function splitByUnits(total, perLot) {
  if (!isPositiveInteger(total) || !isPositiveInteger(perLot)) return []
  const garments = Number(total)
  const size = Number(perLot)
  const count = Math.ceil(garments / size)
  if (count > MAX_LOTS) return []
  return Array.from({ length: count }, (_, i) => (i < count - 1 ? size : garments - size * (count - 1)))
}

/** Lotes que se van a crear: los indicados o, si no se dividió, uno solo con todo el total. */
export const effectiveLots = (total, sizes) => (sizes.length > 0 ? sizes : isPositiveInteger(total) ? [String(total)] : [])

/** Variantes ya elegidas en otras filas del lote (para deshabilitarlas en el desplegable de una fila). */
export const takenByOthers = (rows, index) => new Set(rows.filter((_, i) => i !== index).map((row) => row.variante).filter(Boolean))

/**
 * Problemas de las tallas de un lote. Las tallas son opcionales: un lote sin filas está bien. Si hay filas, cada una
 * necesita su variante (sin repetir) y un entero mayor que cero, y deben sumar justo las prendas del lote.
 *
 * @param {{variante: string, cantidad: string}[]} rows
 * @param {number|string} expected Prendas del lote.
 * @returns {{byRow: string[][], general: string[], assigned: number, difference: number, valid: boolean}}
 */
export function sizeProblems(rows, expected) {
  const target = isPositiveInteger(expected) ? Number(expected) : 0
  const assigned = lotsSum(rows.map((row) => row.cantidad))
  const picked = rows.map((row) => row.variante).filter(Boolean)
  const byRow = rows.map((row) => {
    const problems = []
    if (!row.variante) problems.push('Elige la talla.')
    else if (picked.filter((variant) => variant === row.variante).length > 1) problems.push('Esta talla ya está en el lote.')
    if (!isPositiveInteger(row.cantidad)) problems.push('Usa un entero mayor que cero.')
    return problems
  })
  const general = []
  const difference = target - assigned
  if (rows.length > 0 && byRow.every((problems) => problems.length === 0)) {
    if (difference > 0) general.push(`Faltan ${difference} prendas para completar el lote.`)
    if (difference < 0) general.push(`Sobran ${-difference} prendas en el lote.`)
  }
  const valid = rows.length === 0 || (byRow.every((problems) => problems.length === 0) && difference === 0)
  return { byRow, general, assigned, difference, valid }
}

/**
 * Prendas por talla de toda la orden, sumando los lotes. Ordenadas por talla y color.
 *
 * @param {{variante: string, cantidad: string}[][]} rowsByLot
 * @param {(id: string) => {talla: string, color: string}|undefined} variantOf
 * @returns {{variante: string, talla: string, color: string, cantidad: number}[]}
 */
export function sizeTotals(rowsByLot, variantOf) {
  const totals = new Map()
  for (const rows of rowsByLot) {
    for (const row of rows) {
      const variant = variantOf(row.variante)
      if (!variant || !isPositiveInteger(row.cantidad)) continue
      const current = totals.get(row.variante) ?? { variante: row.variante, talla: variant.talla, color: variant.color, cantidad: 0 }
      current.cantidad += Number(row.cantidad)
      totals.set(row.variante, current)
    }
  }
  return [...totals.values()].sort(
    (a, b) => a.talla.localeCompare(b.talla, 'es', { numeric: true }) || a.color.localeCompare(b.color, 'es'),
  )
}

/** Cuerpo del POST de la orden: las tallas solo viajan en los lotes que las definieron. */
export function buildOrderBody({ referencia, total, resultado, sizes, rowsByLot, responsable = '', observaciones = '' }) {
  const body = { referencia: Number(referencia), cantidad: Number(total), producto_resultado: Number(resultado) }
  if (responsable.trim()) body.responsable = responsable.trim()
  if (observaciones.trim()) body.observaciones = observaciones.trim()
  body.lotes = effectiveLots(total, sizes).map((size, index) => {
    const rows = rowsByLot[index] ?? []
    const lot = { cantidad: Number(size) }
    if (rows.length > 0) lot.tallas = rows.map((row) => ({ variante: Number(row.variante), cantidad: Number(row.cantidad) }))
    return lot
  })
  return body
}

/**
 * Motivos por los que todavía no se puede crear la orden (vacío si se puede).
 *
 * @param {object} state
 * @param {{tiene_ficha: boolean}|undefined} state.reference La referencia elegida.
 * @param {string} state.total Prendas a producir.
 * @param {string} state.resultado Pantalón genérico elegido.
 * @param {string[]} state.sizes Tamaños de los lotes (vacío si no se divide).
 * @param {{variante: string, cantidad: string}[][]} state.rowsByLot Tallas de cada lote.
 */
export function orderProblems({ reference, total, resultado, sizes, rowsByLot }) {
  if (!reference) return ['Elige la referencia.']
  if (!reference.tiene_ficha) return ['La referencia no tiene ficha técnica.']
  if (!isPositiveInteger(total)) return ['Indica cuántas prendas se van a producir.']
  if (Number(total) > MAX_GARMENTS) return [`Máximo ${MAX_GARMENTS} prendas.`]
  const lots = lotProblems(sizes, total)
  if (lots.length) return lots
  if (!resultado) return ['Elige el pantalón genérico que se producirá.']
  const lotSizes = effectiveLots(total, sizes)
  for (let index = 0; index < lotSizes.length; index += 1) {
    const check = sizeProblems(rowsByLot[index] ?? [], lotSizes[index])
    if (!check.valid) return [`Revisa las tallas del lote ${index + 1}.`]
  }
  return []
}
