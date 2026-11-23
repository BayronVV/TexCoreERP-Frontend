/** Utilidades de las pantallas «Accesos» y «Auditoría» (HU 1.5). */

/** Convierte los filtros de la pantalla en una query string, sin los campos vacíos. */
export function buildLogQuery(filters, page = 1) {
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(filters)) {
    if (String(value ?? '').trim()) params.set(key, String(value).trim())
  }
  if (page > 1) params.set('page', String(page))
  const text = params.toString()
  return text ? `?${text}` : ''
}

/** Fecha y hora local legible: «22 nov 2026, 10:35 p. m.». */
export function formatDateTime(value) {
  if (!value) return '—'
  return new Date(value).toLocaleString('es-CO', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export const ACCESS_RESULTS = [
  { value: 'exitoso', label: 'Exitosos' },
  { value: 'fallido', label: 'Fallidos' },
  { value: 'bloqueado', label: 'Bloqueos' },
]

export const AUDIT_RESULTS = [
  { value: 'exito', label: 'Éxito' },
  { value: 'rechazado', label: 'Rechazado por permiso' },
  { value: 'error', label: 'Error' },
]

/** Nombre legible de una acción auditada, p. ej. `factura.anular` → «Factura · anular». */
export function actionLabel(action) {
  const [entity = '', verb = ''] = String(action).split('.')
  const noun = entity.replaceAll('_', ' ')
  return verb ? `${noun.charAt(0).toUpperCase()}${noun.slice(1)} · ${verb.replaceAll('_', ' ')}` : action
}

/** Clase del distintivo de color según el resultado (accesos o auditoría). */
export function resultTone(result) {
  if (result === 'exitoso' || result === 'exito') return 'on'
  if (result === 'fallido' || result === 'error') return 'off'
  return 'warn'
}
