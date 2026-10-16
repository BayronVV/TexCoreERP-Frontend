// Lógica pura del monitor de estado (HU 4.5): qué hace arrastrar una tarjeta a otra columna, qué botones lleva cada tarjeta y
// cómo se muestran las edades. El estado de un lote no se asigna: sale de sus etapas, así que mover una tarjeta es pedirle al
// servidor la acción que corresponde (iniciar, pausar, reanudar o terminar la etapa) y el servidor es quien decide.
import { buttonsFor, formatDuration } from './lotTracking.js'

export const PLANNED = 'PLANEADA'
export const RUNNING = 'EN_PROCESO'
export const PAUSED = 'EN_PAUSA'
export const DONE = 'TERMINADA'
export const CANCELLED = 'CANCELADA'

/** Las columnas del tablero, en orden. */
export const COLUMN_STATES = [PLANNED, RUNNING, PAUSED, DONE]

/** Intervalo de refresco del tablero, en milisegundos (el sondeo se pausa con la pestaña oculta). */
export const REFRESH_MS = 20_000

/**
 * Qué pasa si se suelta la tarjeta de un lote en la columna `target`.
 * Devuelve `{ action }` con la acción que hay que pedir al servidor, `{ noop: true }` si se soltó donde ya estaba, o
 * `{ reason }` con el motivo por el que no se puede.
 *
 * @param {{estado: string, acciones: string[], termina_el_lote: boolean}} lot Tarjeta del tablero.
 * @param {string} target Estado de la columna de destino.
 */
export function dropOutcome(lot, target) {
  if (lot.estado === target) return { noop: true }
  const can = (action) => lot.acciones.includes(action)
  if (lot.estado === DONE) return { reason: 'Un lote terminado ya no se mueve.' }
  if (lot.estado === CANCELLED) return { reason: 'Los lotes de una orden anulada no se mueven.' }
  if (target === CANCELLED) return { reason: 'Una orden se cancela anulándola en Órdenes de producción.' }
  if (target === PLANNED) return { reason: 'Un lote no vuelve a Planeada una vez que empezó.' }
  if (target === RUNNING) {
    if (can('reanudar')) return { action: 'reanudar' }
    if (can('iniciar')) return { action: 'iniciar' }
    return { reason: 'Ese lote no puede ponerse en proceso ahora.' }
  }
  if (target === PAUSED) {
    return can('pausar') ? { action: 'pausar' } : { reason: 'Solo se pausa un lote que tiene una etapa en marcha.' }
  }
  // Terminada: solo cuando terminar la etapa en curso deja el lote terminado (es la última etapa).
  if (lot.termina_el_lote && can('completar')) return { action: 'completar' }
  return { reason: 'Un lote se termina al acabar su última etapa (Terminación).' }
}

/** ¿Se puede soltar esta tarjeta en la columna? (para atenuar las columnas que no valen mientras se arrastra) */
export const canDrop = (lot, target) => Boolean(dropOutcome(lot, target).action)

/** Botones de avance rápido de la tarjeta: solo las acciones que el lote admite ahora. */
export const cardButtons = (lot) => buttonsFor(lot.acciones).filter((button) => button.enabled)

/**
 * Mueve un lote de columna sin pedirle nada al servidor, para que el tablero responda al instante. Si el servidor rechaza la
 * acción, se vuelve a cargar el tablero y la tarjeta regresa a su sitio. No modifica el original.
 *
 * @param {{estado: string, total: number, lotes: object[]}[]} columns
 * @param {number} lotId
 * @param {string} target
 */
export function moveLot(columns, lotId, target) {
  const lot = columns.flatMap((column) => column.lotes).find((card) => card.id === lotId)
  if (!lot) return columns
  return columns.map((column) => {
    const has = column.lotes.some((card) => card.id === lotId)
    if (column.estado === target && !has) return { ...column, total: column.total + 1, lotes: [{ ...lot, estado: target }, ...column.lotes] }
    if (column.estado !== target && has) return { ...column, total: column.total - 1, lotes: column.lotes.filter((card) => card.id !== lotId) }
    return column
  })
}

/** Antigüedad legible de un momento: `hace 30 s`, `hace 12 min`, `hace 3 h`, `hace 2 d`. Vacío si no hay fecha. */
export function ageLabel(moment, now) {
  if (!moment) return ''
  const seconds = Math.max(0, Math.floor((now - new Date(moment).getTime()) / 1000))
  if (seconds < 60) return `hace ${seconds} s`
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `hace ${minutes} min`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `hace ${hours} h`
  return `hace ${Math.floor(hours / 24)} d`
}

/** Texto del último refresco, p. ej. `Actualizado hace 12 s`. */
export const refreshLabel = (generatedAt, now) => (generatedAt ? `Actualizado ${ageLabel(generatedAt, now)}` : 'Cargando…')

/** Cuántas tarjetas faltan por mostrar en una columna (su total real menos las que llegaron). */
export const hiddenCount = (column) => Math.max(0, column.total - column.lotes.length)

/** Total de lotes del tablero (suma de las cuatro columnas). */
export const boardTotal = (columns) => columns.reduce((sum, column) => sum + column.total, 0)

/** Parámetros de la consulta del tablero: solo los filtros elegidos. */
export function boardQuery({ orden = '', referencia = '', limite = '', canceladas = false } = {}) {
  const params = new URLSearchParams()
  if (orden) params.set('orden', orden)
  if (referencia) params.set('referencia', referencia)
  if (limite) params.set('limite', limite)
  if (canceladas) params.set('canceladas', '1')
  const text = params.toString()
  return text ? `?${text}` : ''
}

/**
 * Columna en la que cae la tarjeta tras una acción, o `null` si la acción no cambia su columna (terminar una etapa que no
 * es la última deja el lote en proceso). Sirve para mover la tarjeta al instante mientras el servidor responde.
 */
export function targetOfAction(lot, action) {
  if (action === 'iniciar' || action === 'reanudar') return RUNNING
  if (action === 'pausar') return PAUSED
  if (action === 'completar') return lot.termina_el_lote ? DONE : null
  return null
}

/** Niveles de alerta que calcula el servidor para un lote detenido (en pausa o entre etapas): desde 2 h y desde 8 h. */
export const ALERT_ATTENTION = 'ATENCION'
export const ALERT_CRITICAL = 'CRITICA'

/**
 * Aviso de una tarjeta detenida, o `null` si no hay alerta. El nivel lo decide el servidor (`lote.alerta`); aquí solo se
 * escribe el texto, con la espera que sigue corriendo desde que llegaron los datos.
 *
 * @param {{alerta: string|null, estado: string, espera_segundos: number|null}} lot
 * @param {number} fetchedAt Milisegundos en que llegó la respuesta.
 * @param {number} now Milisegundos actuales.
 */
export function alertInfo(lot, fetchedAt, now) {
  if (!lot.alerta) return null
  const waited = formatDuration((lot.espera_segundos ?? 0) + Math.max(0, Math.floor((now - fetchedAt) / 1000)))
  const what = lot.estado === PAUSED ? `En pausa hace ${waited}` : `Esperando la siguiente etapa hace ${waited}`
  return { level: lot.alerta, label: lot.alerta === ALERT_CRITICAL ? 'Crítica' : 'Atención', text: what }
}

/** Resumen de alertas del tablero (`{atencion, critica}`), p. ej. `2 lotes con alerta crítica · 1 con atención`. Vacío si no hay. */
export function alertSummary(alertas) {
  const critical = alertas?.critica ?? 0
  const attention = alertas?.atencion ?? 0
  const parts = []
  if (critical) parts.push(`${critical} lote${critical === 1 ? '' : 's'} con alerta crítica`)
  if (attention) parts.push(`${attention} ${critical ? '' : `lote${attention === 1 ? '' : 's'} `}con atención`)
  return parts.join(' · ')
}
