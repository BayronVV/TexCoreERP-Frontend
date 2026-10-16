// Costos en pesos colombianos (HU 4.6, parte de compras): cómo se muestran y cómo se valida el costo unitario de una compra.
// El servidor es quien valida y guarda; estas funciones solo avisan antes de enviar.

const PESOS = new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0, maximumFractionDigits: 2 })

/** Dinero legible (`$ 18.500`, `$ 1.234,56`), o `—` si no hay un número. */
export function formatMoney(value) {
  if (value === null || value === undefined || value === '' || !Number.isFinite(Number(value))) return '—'
  return PESOS.format(Number(value))
}

/**
 * Problema del costo unitario escrito en el formulario, o `''` si está bien. El costo es opcional: vacío no es un error.
 * Debe ser mayor que cero y tener hasta 4 decimales, escritos con punto.
 *
 * @param {string} text
 */
export function costError(text) {
  const value = String(text ?? '').trim()
  if (!value) return ''
  if (value.startsWith('-')) return 'El costo debe ser mayor que cero.'
  if (!/^\d+(\.\d+)?$/.test(value)) return 'Escribe un número; los decimales van con punto.'
  if (value.split('.')[1]?.length > 4) return 'El costo admite hasta 4 decimales.'
  if (Number(value) <= 0) return 'El costo debe ser mayor que cero.'
  return ''
}

/** Valor de una compra (cantidad × costo unitario) para mostrarlo como confirmación, o `null` si falta algún dato válido. */
export function purchaseValue(quantity, cost) {
  const total = Number(quantity) * Number(cost)
  if (!(Number(quantity) > 0) || costError(cost) || String(cost ?? '').trim() === '' || !Number.isFinite(total)) return null
  return Math.round(total * 100) / 100
}
