// Lógica pura del control de tiempos por etapa (HU 4.3): cómo se muestra el tiempo y qué botones se ofrecen. El servidor
// es quien decide qué acciones admite un lote (`lote.acciones`) y quien calcula el tiempo neto; aquí solo se presenta.

/** Los botones del lote: Play (iniciar o reanudar), Pausa y Stop (terminar la etapa en curso). */
export const ACTION_BUTTONS = [
  { id: 'iniciar', label: 'Iniciar', symbol: '▶' },
  { id: 'reanudar', label: 'Reanudar', symbol: '▶' },
  { id: 'pausar', label: 'Pausar', symbol: '⏸' },
  { id: 'completar', label: 'Terminar etapa', symbol: '⏹' },
]

/** Botones habilitados según las acciones que admite el lote; el resto se muestra deshabilitado. */
export const buttonsFor = (actions) => ACTION_BUTTONS.map((button) => ({ ...button, enabled: actions.includes(button.id) }))

/**
 * Tiempo legible: `0 s`, `45 s`, `12 min 05 s`, `1 h 05 min`. Pasa de los segundos a las horas sin decimales.
 *
 * @param {number} totalSeconds
 */
export function formatDuration(totalSeconds) {
  const seconds = Math.max(0, Math.floor(Number(totalSeconds) || 0))
  if (seconds < 60) return `${seconds} s`
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes} min ${String(seconds % 60).padStart(2, '0')} s`
  return `${Math.floor(minutes / 60)} h ${String(minutes % 60).padStart(2, '0')} min`
}

/**
 * Segundos netos de una etapa en este instante. Si corre, suma lo transcurrido desde que llegó la respuesta del servidor
 * (así el reloj avanza sin pedir datos cada segundo); en pausa o terminada, es el valor del servidor.
 *
 * @param {{tiempo_neto_segundos: number, en_curso_desde: string|null}} stage
 * @param {number} fetchedAt Milisegundos en que se recibió la respuesta.
 * @param {number} now Milisegundos actuales.
 */
export function liveSeconds(stage, fetchedAt, now) {
  const base = Number(stage.tiempo_neto_segundos) || 0
  if (!stage.en_curso_desde) return base
  return base + Math.max(0, Math.floor((now - fetchedAt) / 1000))
}

/** Segundos netos de todo el lote en este instante (suma de sus etapas). */
export const lotLiveSeconds = (lot, fetchedAt, now) =>
  lot.etapas.reduce((sum, stage) => sum + liveSeconds(stage, fetchedAt, now), 0)

/** ¿Alguna etapa del lote está corriendo? Solo entonces hace falta refrescar el reloj cada segundo. */
export const isRunning = (lot) => lot.etapas.some((stage) => Boolean(stage.en_curso_desde))

/** Etapas terminadas y totales, p. ej. `{ done: 2, total: 6 }`. */
export const stageProgress = (lot) => ({
  done: lot.etapas.filter((stage) => stage.estado === 'COMPLETADA').length,
  total: lot.etapas.length,
})

/** Reemplaza un lote dentro de una orden por su versión nueva (la que devuelve el servidor tras una acción). */
export const replaceLot = (order, lot) => ({ ...order, lotes: order.lotes.map((current) => (current.id === lot.id ? lot : current)) })

/** Cuántos lotes de la orden están en cada estado, p. ej. `{ EN_PROCESO: 1, PLANEADA: 2 }`. */
export function countByState(lots) {
  const counts = {}
  for (const lot of lots) counts[lot.estado] = (counts[lot.estado] ?? 0) + 1
  return counts
}
