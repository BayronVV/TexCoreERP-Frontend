// Filas de la ficha técnica de consumo por unidad (HU 3.2). Funciones puras que repiten las reglas del servidor
// para avisar al instante; el servidor sigue siendo quien valida y quien calcula el consumo de las órdenes.

const WHOLE = ['rollo', 'caja', 'unidad']
export const MAX_ROWS = 50
export const MAX_CONSUMPTION = 1000
export const MAX_WASTE = 50

/** Tipos de producto que pueden entrar a una ficha (los que se compran). */
export const MATERIAL_TYPES = ['MATERIA_PRIMA', 'INSUMO']

/** Una fila vacía de la tabla de materiales. */
export const emptyRow = () => ({ producto: '', cantidad: '', merma: '0', observaciones: '' })

/** Filas de la tabla a partir de las líneas que devuelve la API (todo como texto, para los campos). */
export const rowsFromLines = (lines) =>
  lines.map((line) => ({
    producto: String(line.producto),
    cantidad: String(Number(line.cantidad)), // 1.500 -> 1.5
    merma: String(Number(line.merma)),
    observaciones: line.observaciones ?? '',
  }))

/** ¿La unidad solo admite piezas enteras? (unidad, caja, rollo) */
export const isWhole = (unit) => WHOLE.includes(unit)

/** Cuántos decimales tiene un texto numérico (`'1.25'` → 2). */
const decimals = (text) => (String(text).split('.')[1] ?? '').length

/**
 * Consumo por prenda con la merma incluida (solo informativo: las órdenes lo calculan en el servidor).
 * @returns {number|null} `null` si la cantidad o la merma no son números válidos.
 */
export function grossPerGarment(row) {
  const quantity = Number(row.cantidad)
  const waste = Number(row.merma || 0)
  if (!(quantity > 0) || !Number.isFinite(waste) || waste < 0) return null
  return Math.round(quantity * (1 + waste / 100) * 10000) / 10000
}

/**
 * Problemas de una fila (vacío si está bien).
 * @param {{producto: string, cantidad: string, merma: string}} row
 * @param {{unidad: string, tipo: string, nombre: string}|undefined} product
 */
export function rowProblems(row, product) {
  if (!row.producto || !product) return ['Elige el material.']
  const problems = []
  if (!MATERIAL_TYPES.includes(product.tipo)) problems.push('Solo materias primas e insumos.')
  const quantity = Number(row.cantidad)
  if (row.cantidad === '' || !Number.isFinite(quantity) || quantity <= 0) problems.push('Escribe la cantidad por prenda.')
  else if (quantity > MAX_CONSUMPTION) problems.push(`Máximo ${MAX_CONSUMPTION} por prenda.`)
  else if (decimals(row.cantidad) > 3) problems.push('Máximo 3 decimales.')
  else if (isWhole(product.unidad) && !Number.isInteger(quantity)) problems.push('Esta unidad se cuenta en piezas enteras.')
  const waste = Number(row.merma || 0)
  if (!Number.isFinite(waste) || waste < 0 || waste > MAX_WASTE) problems.push(`La merma va de 0 a ${MAX_WASTE} %.`)
  else if (decimals(row.merma ?? '') > 2) problems.push('La merma admite 2 decimales.')
  else if (waste > 0 && isWhole(product.unidad)) problems.push('Las piezas enteras no llevan merma.')
  return problems
}

/**
 * Problemas de toda la tabla: filas sin material, repetidos y límites. Devuelve `{ general: string[], byRow: string[][] }`.
 * @param {{producto: string}[]} rows
 * @param {(id: string) => object|undefined} productOf
 */
export function tableProblems(rows, productOf) {
  const general = []
  if (rows.length === 0) general.push('Agrega al menos un material.')
  if (rows.length > MAX_ROWS) general.push(`Máximo ${MAX_ROWS} materiales.`)
  const ids = rows.map((row) => row.producto).filter(Boolean)
  if (new Set(ids).size !== ids.length) general.push('Un material aparece dos veces.')
  const byRow = rows.map((row) => rowProblems(row, productOf(row.producto)))
  return { general, byRow }
}

/** Materiales ya usados en otras filas (para deshabilitarlos en el desplegable de una fila). */
export const usedByOthers = (rows, index) => new Set(rows.filter((_, i) => i !== index).map((row) => row.producto).filter(Boolean))

/** Cuerpo del PUT de la ficha: lista completa de materiales, con los números como texto. */
export const toPayload = ({ lavado, notas, rows }) => ({
  lavado,
  notas,
  lineas: rows.map((row) => ({
    producto: Number(row.producto),
    cantidad: row.cantidad,
    merma: row.merma === '' ? '0' : row.merma,
    observaciones: row.observaciones.trim(),
  })),
})

/** Tamaño legible de un archivo (`1536` → `1,5 KB`). */
export function formatBytes(bytes) {
  if (!Number.isFinite(bytes) || bytes < 0) return ''
  if (bytes < 1024) return `${bytes} B`
  const kb = bytes / 1024
  if (kb < 1024) return `${kb.toLocaleString('es-CO', { maximumFractionDigits: 1 })} KB`
  return `${(kb / 1024).toLocaleString('es-CO', { maximumFractionDigits: 1 })} MB`
}
