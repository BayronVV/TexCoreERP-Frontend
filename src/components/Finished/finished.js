// Producto terminado (HU 6.2): lógica pura de los formularios, sin React ni DOM, para probarla con `node --test`. El servidor
// valida todo (suma exacta, variantes de la referencia, un ingreso por inspección, permisos); aquí solo se ofrece lo que tiene
// sentido y se avisa antes de enviar. El saldo nunca se calcula en el navegador: solo se muestra lo que devuelve el servidor.

const isCount = (text, minimum = 0) => /^\d+$/.test(String(text ?? '').trim()) && Number(String(text).trim()) >= minimum

/** Orden de las tallas: las numéricas por valor y después las demás por nombre. */
export const sizeSort = (a, b) => {
  const aNum = /^\d+$/.test(a)
  const bNum = /^\d+$/.test(b)
  if (aNum && bNum) return Number(a) - Number(b)
  if (aNum) return -1
  if (bNum) return 1
  return String(a).localeCompare(String(b), 'es')
}

/** Variantes agrupadas por color (filas) con sus tallas ordenadas (columnas). Devuelve `{ sizes, rows }`. */
export function variantMatrix(variants) {
  const sizes = [...new Set((variants ?? []).map((variant) => variant.talla))].sort(sizeSort)
  const byColor = new Map()
  for (const variant of variants ?? []) {
    if (!byColor.has(variant.color)) byColor.set(variant.color, {})
    byColor.get(variant.color)[variant.talla] = variant
  }
  const rows = [...byColor.entries()].sort(([a], [b]) => a.localeCompare(b, 'es')).map(([color, cells]) => ({ color, cells }))
  return { sizes, rows }
}

/** Lo planificado en el lote por variante: `{ idVariante: cantidad }`. */
export const plannedMap = (pending) => Object.fromEntries((pending?.planificado ?? []).map((row) => [row.variante, row.cantidad]))

/** Cantidades iniciales del formulario: lo planificado solo si suma exactamente las aptas; si no, todo vacío. */
export function initialQuantities(pending) {
  const planned = plannedMap(pending)
  const total = Object.values(planned).reduce((sum, value) => sum + value, 0)
  if (total !== pending.aptas) return {}
  return Object.fromEntries(Object.entries(planned).map(([id, quantity]) => [id, String(quantity)]))
}

/** Suma de lo escrito (las celdas mal escritas cuentan como cero). */
export const enteredTotal = (quantities) =>
  Object.values(quantities ?? {}).reduce((sum, value) => sum + (isCount(value, 1) ? Number(String(value).trim()) : 0), 0)

/** Cómo va el reparto: lo escrito contra las aptas. `difference` positivo = faltan; negativo = sobran. */
export function balance(aptas, quantities) {
  const sum = enteredTotal(quantities)
  const difference = aptas - sum
  let message = 'El reparto por talla cuadra con las aptas.'
  if (difference > 0) message = `Faltan ${difference} ${difference === 1 ? 'prenda' : 'prendas'} por ubicar en una talla.`
  if (difference < 0) message = `Sobran ${-difference} ${difference === -1 ? 'prenda' : 'prendas'}: revisa las cantidades.`
  return { sum, difference, ok: difference === 0, message }
}

/** Motivos por los que todavía no se puede registrar el ingreso (vacío si está listo). */
export function entryProblems({ pending, quantities }) {
  if (!pending) return ['Elige la inspección.']
  const problems = []
  if (Object.values(quantities ?? {}).some((value) => String(value ?? '').trim() !== '' && !isCount(value, 0))) {
    problems.push('Revisa las cantidades: deben ser números enteros.')
  }
  const state = balance(pending.aptas, quantities)
  if (!state.ok) problems.push(state.message)
  return problems
}

/** Cuerpo del POST: una línea por variante con cantidad mayor que cero. */
export function entryBody({ pending, quantities, ubicacion, observaciones }) {
  return {
    inspeccion: pending.inspeccion,
    lineas: Object.entries(quantities)
      .filter(([, value]) => isCount(value, 1))
      .map(([id, value]) => ({ variante: Number(id), cantidad: Number(String(value).trim()) })),
    ubicacion: (ubicacion ?? '').trim(),
    observaciones: (observaciones ?? '').trim(),
  }
}

/** Texto de la confirmación previa: el ingreso no se puede editar ni borrar. */
export const confirmationText = (pending, quantities) =>
  `Vas a ingresar ${enteredTotal(quantities)} prendas aptas del lote ${pending.lote_codigo} al inventario final. ` +
  'Un ingreso no se puede editar ni borrar. ¿Registrarlo?'

/** Diferencia contra lo planificado en el lote (vacía si no había desglose). */
export const differenceLabel = (line) => {
  if (line.diferencia === null || line.diferencia === undefined) return '—'
  if (line.diferencia === 0) return 'igual'
  return `${line.diferencia > 0 ? '+' : ''}${line.diferencia}`
}

/** Cantidad de un movimiento con su signo («+20», «−5»). */
export const signed = (quantity) => (quantity > 0 ? `+${quantity}` : `−${Math.abs(quantity)}`)

/** Ingresos de los últimos `days` días contando hoy (fechas `YYYY-MM-DD`), para el aviso del inicio. */
export function recentEntries(entries, today, days = 7) {
  const limit = new Date(`${today}T00:00:00`)
  limit.setDate(limit.getDate() - (days - 1))
  return (entries ?? []).filter((entry) => new Date(`${entry.fecha}T00:00:00`) >= limit)
}

/** Etiqueta de una variante. */
export const variantLabel = (variant) => `${variant.talla} · ${variant.color}`
