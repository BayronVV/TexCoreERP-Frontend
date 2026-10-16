// Lógica pura de la planificación de producción (HU 4.1): cómo se divide el total en lotes y por qué no se puede crear
// todavía la orden. Repite las reglas del servidor para avisar al instante; el servidor es quien valida y simula.
import { isPositiveInteger } from '../Inventory/orderLines.js'

/** Prendas máximas por simulación y lotes máximos: iguales a los del backend. */
export const MAX_GARMENTS = 100000
export const MAX_LOTS = 50

/**
 * Reparte `total` prendas en `count` lotes lo más parejos posible; el resto va a los primeros lotes (10 en 3 → 4, 3, 3).
 * Devuelve la lista vacía si no se puede: datos no enteros, menos de un lote, más lotes que prendas o más de `MAX_LOTS`.
 *
 * @param {number|string} total
 * @param {number|string} count
 * @returns {number[]}
 */
export function splitEvenly(total, count) {
  if (!isPositiveInteger(total) || !isPositiveInteger(count)) return []
  const prendas = Number(total)
  const lotes = Number(count)
  if (lotes > MAX_LOTS || lotes > prendas) return []
  const base = Math.floor(prendas / lotes)
  const extra = prendas % lotes
  return Array.from({ length: lotes }, (_, i) => base + (i < extra ? 1 : 0))
}

/** Suma de los tamaños que son enteros positivos; lo demás (vacío, decimales, texto) no cuenta. */
export const lotsSum = (sizes) => sizes.reduce((sum, size) => sum + (isPositiveInteger(size) ? Number(size) : 0), 0)

/**
 * Problemas de la división en lotes (vacío si está bien o si no se dividió). Cada lote es un entero mayor que cero,
 * hay como máximo `MAX_LOTS` y la suma debe ser exactamente el total.
 *
 * @param {string[]} sizes Tamaños como texto (lo que hay en los campos).
 * @param {number|string} total
 * @returns {string[]}
 */
export function lotProblems(sizes, total) {
  if (sizes.length === 0) return []
  const problems = []
  if (sizes.length > MAX_LOTS) problems.push(`Máximo ${MAX_LOTS} lotes.`)
  const invalid = sizes.map((size, i) => (isPositiveInteger(size) ? null : i + 1)).filter(Boolean)
  if (invalid.length) problems.push(`Revisa el lote ${invalid.join(', ')}: debe ser un número entero mayor que cero.`)
  if (isPositiveInteger(total) && invalid.length === 0) {
    const difference = Number(total) - lotsSum(sizes)
    if (difference > 0) problems.push(`Faltan ${difference} prendas por asignar a un lote.`)
    if (difference < 0) problems.push(`Sobran ${-difference} prendas: los lotes suman más que el total.`)
  }
  return problems
}

/** ¿Los lotes se pueden enviar a simular? Hay lotes y no tienen problemas. */
export const lotsReady = (sizes, total) => sizes.length > 0 && lotProblems(sizes, total).length === 0

/** Cuerpo del POST de la simulación: los lotes solo viajan si están completos y bien repartidos. */
export function buildSimulationBody({ referencia, total, sizes }) {
  const body = { referencia: Number(referencia), cantidad: Number(total) }
  if (lotsReady(sizes, total)) body.lotes = sizes.map(Number)
  return body
}

/**
 * Motivos por los que todavía no se puede crear la orden (vacío si se puede).
 *
 * @param {object} state
 * @param {{tiene_ficha: boolean}|undefined} state.reference La referencia elegida.
 * @param {string} state.total Prendas a producir.
 * @param {string[]} state.sizes Tamaños de los lotes (vacío si no se divide).
 * @param {{loading: boolean, error: string, data: object|null}} state.plan Resultado de la simulación.
 */
export function planProblems({ reference, total, sizes, plan }) {
  if (!reference) return ['Elige la referencia.']
  if (!reference.tiene_ficha) return ['La referencia no tiene ficha técnica.']
  if (!isPositiveInteger(total)) return ['Indica cuántas prendas se van a producir.']
  if (Number(total) > MAX_GARMENTS) return [`Máximo ${MAX_GARMENTS} prendas.`]
  const lots = lotProblems(sizes, total)
  if (lots.length) return lots
  if (plan.error) return [plan.error]
  // Un resultado de otra cantidad (o de otros lotes) no vale: hay que esperar a que se actualice.
  const stale = plan.loading || !plan.data || plan.data.cantidad !== Number(total)
    || (sizes.length > 0 && !plan.data.lotes)
  if (stale) return ['Calculando la disponibilidad de material…']
  if (!plan.data.viable) {
    return [`Falta material: ${plan.data.faltantes.map((row) => row.nombre).join(', ')}.`]
  }
  return []
}
