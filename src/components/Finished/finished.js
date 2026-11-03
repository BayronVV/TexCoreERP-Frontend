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

// --- Ajuste manual (HU 6.3) -----------------------------------------------------------------------------------------------
// La persona digita el conteo real de la bodega y el navegador solo calcula las diferencias de lo digitado para mostrarlas; el
// servidor vuelve a validar todo (saldo esperado, signo del motivo, más de 20 unidades por línea, observación) y escribe el libro.

/** Conteo inicial de la matriz: el saldo que mostraba el sistema en cada celda (`{ idVariante: 'saldo' }`). */
export function initialCounts(reference) {
  const counts = {}
  for (const row of reference?.colores ?? []) {
    for (const cell of Object.values(row.tallas)) counts[cell.variante] = String(cell.cantidad)
  }
  return counts
}

/** Las celdas de la referencia como `{ variante, talla, color, esperado }`. */
export function referenceCells(reference) {
  return (reference?.colores ?? []).flatMap((row) =>
    Object.entries(row.tallas).map(([talla, cell]) => ({ variante: cell.variante, talla, color: row.color, esperado: cell.cantidad })),
  )
}

/** Celdas con un conteo mal escrito (vacío, decimal, negativo o texto). */
export const invalidCounts = (reference, counts) =>
  referenceCells(reference).filter((cell) => !isCount(counts?.[cell.variante], 0))

/** Líneas con diferencia: `{ variante, talla, color, esperado, contado, diferencia }` (las celdas mal escritas no cuentan). */
export function adjustmentLines(reference, counts) {
  return referenceCells(reference)
    .filter((cell) => isCount(counts?.[cell.variante], 0))
    .map((cell) => ({ ...cell, contado: Number(String(counts[cell.variante]).trim()) }))
    .map((cell) => ({ ...cell, diferencia: cell.contado - cell.esperado }))
    .filter((cell) => cell.diferencia !== 0)
}

/** Faltantes y sobrantes por separado (nunca netos). */
export function adjustmentSummary(lines) {
  const missing = lines.filter((line) => line.diferencia < 0).reduce((sum, line) => sum - line.diferencia, 0)
  const surplus = lines.filter((line) => line.diferencia > 0).reduce((sum, line) => sum + line.diferencia, 0)
  return { missing, surplus, lines: lines.length }
}

const unitsText = (count) => `${count} ${count === 1 ? 'prenda' : 'prendas'}`

/** «Faltan 3 prendas · sobra 1 prenda» o «Sin diferencias». */
export function summaryText({ missing, surplus }) {
  const parts = []
  if (missing > 0) parts.push(`${missing === 1 ? 'Falta' : 'Faltan'} ${unitsText(missing)}`)
  if (surplus > 0) parts.push(`${surplus === 1 ? 'Sobra' : 'Sobran'} ${unitsText(surplus)}`)
  return parts.length ? parts.join(' · ') : 'Sin diferencias'
}

/** Líneas que cambian MÁS de `threshold` unidades (RF22). */
export const largeLines = (lines, threshold) => lines.filter((line) => Math.abs(line.diferencia) > threshold)

/** Motivos por los que todavía no se puede ajustar (vacío si está listo). `meta` es la respuesta de `/api/terminado/metadatos/`. */
export function adjustmentProblems({ reference, counts, motivo, observacion, meta }) {
  const problems = []
  if (invalidCounts(reference, counts).length) problems.push('Revisa los conteos: deben ser números enteros desde cero.')
  const lines = adjustmentLines(reference, counts)
  if (!lines.length) problems.push('No hay diferencias: cambia el conteo de alguna talla.')
  const reason = (meta?.motivos ?? []).find((item) => item.codigo === motivo)
  if (!reason) {
    problems.push('Elige el motivo del ajuste.')
  } else {
    if (reason.signo === '-' && lines.some((line) => line.diferencia > 0)) problems.push(`«${reason.nombre}» solo puede restar prendas.`)
    if (reason.signo === '+' && lines.some((line) => line.diferencia < 0)) problems.push(`«${reason.nombre}» solo puede sumar prendas.`)
  }
  const text = String(observacion ?? '').trim()
  const threshold = meta?.umbral_unidades ?? 20
  const large = largeLines(lines, threshold)
  if (text.length < (meta?.observacion_minima ?? 10)) problems.push(`Explica el ajuste en la observación (mínimo ${meta?.observacion_minima ?? 10} caracteres).`)
  if (large.length) {
    if (motivo === meta?.motivo_no_valido_sobre_umbral) problems.push(`Con más de ${threshold} unidades en una talla, «Otro» no se acepta: elige un motivo concreto.`)
    if (text.length < (meta?.observacion_minima_umbral ?? 30)) problems.push(`Con más de ${threshold} unidades en una talla, la observación pide al menos ${meta?.observacion_minima_umbral ?? 30} caracteres.`)
  }
  return problems
}

/** Cuerpo del POST: solo las líneas con diferencia, cada una con el saldo esperado que vio la persona. */
export function adjustmentBody({ reference, counts, motivo, observacion, token }) {
  return {
    motivo,
    observacion: (observacion ?? '').trim(),
    token,
    lineas: adjustmentLines(reference, counts).map((line) => ({ variante: line.variante, esperado: line.esperado, contado: line.contado })),
  }
}

/** Texto de la confirmación previa, con el detalle de cada línea («30 · Azul: 12 → 10 (−2)»). */
export function adjustmentConfirmation(lines, reasonName) {
  const detail = lines.map((line) => `${variantLabel(line)}: ${line.esperado} → ${line.contado} (${signed(line.diferencia)})`).join('\n')
  return `Vas a ajustar el inventario por «${reasonName}»:\n\n${detail}\n\n${summaryText(adjustmentSummary(lines))}. ` +
    'Un ajuste no se puede editar ni borrar: un error se corrige con otro ajuste. ¿Registrarlo?'
}
