// Envíos y guías (HU 7.2): lógica pura de las pantallas, sin React ni DOM, para probarla con `node --test`. El servidor es quien
// decide los estados permitidos, la urgencia y la cuota de rastreo; aquí solo se da formato y se validan los datos antes de enviar.

import { money } from '../Sales/sales.js'

export { money }

/** Colores de semáforo que entrega el servidor; cualquier otro se muestra como gris. */
export const COLORS = ['gris', 'azul', 'amarillo', 'verde', 'rojo']

/** Clave de color válida (`gris` si el servidor manda algo desconocido o nada). */
export const colorKey = (color) => (COLORS.includes(color) ? color : 'gris')

const COLOR_LABELS = { gris: 'Gris', azul: 'Azul', amarillo: 'Amarillo', verde: 'Verde', rojo: 'Rojo' }

/** Nombre del color del semáforo, para los lectores de pantalla y las leyendas. */
export const colorLabel = (color) => COLOR_LABELS[colorKey(color)]

const URGENCY_LABELS = { normal: 'A tiempo', atencion: 'Atención', vencida: 'Vencida' }

/** Etiqueta corta de la urgencia de una factura sin guía. */
export const urgencyLabel = (urgency) => URGENCY_LABELS[urgency] ?? URGENCY_LABELS.normal

/** Texto de las horas que lleva una factura sin guía: «Hace 5 h», «Hace 2 días y 3 h», «Hace menos de 1 h». */
export function hoursWithoutGuide(hours) {
  const total = Math.max(0, Math.floor(Number(hours) || 0))
  if (total < 1) return 'Hace menos de 1 h'
  if (total < 24) return `Hace ${total} h`
  const days = Math.floor(total / 24)
  const rest = total % 24
  const dayText = `${days} ${days === 1 ? 'día' : 'días'}`
  return rest ? `Hace ${dayText} y ${rest} h` : `Hace ${dayText}`
}

/** Mensaje de la urgencia: lo que debe hacer quien factura. */
export function urgencyMessage(urgency, meta) {
  const attention = meta?.horas_atencion ?? 4
  const overdue = meta?.horas_vencida ?? 24
  if (urgency === 'vencida') return `Lleva más de ${overdue} h sin guía: anótala ya.`
  if (urgency === 'atencion') return `Lleva más de ${attention} h sin guía: anótala lo antes posible.`
  return 'Anota la guía lo antes posible.'
}

/** «hace N min / N h / N días» a partir de una fecha ISO; «nunca» si no hay fecha. `now` se inyecta para poder probarlo. */
export function agoText(iso, now = Date.now()) {
  if (!iso) return 'nunca'
  const time = new Date(iso).getTime()
  if (Number.isNaN(time)) return 'nunca'
  const minutes = Math.max(0, Math.floor((now - time) / 60000))
  if (minutes < 1) return 'hace menos de 1 min'
  if (minutes < 60) return `hace ${minutes} min`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `hace ${hours} h`
  const days = Math.floor(hours / 24)
  return `hace ${days} ${days === 1 ? 'día' : 'días'}`
}

/** Si pasar a ese estado exige una nota (novedad y devolución, según `meta.estados_con_nota`). */
export const requiresNote = (state, meta) => (meta?.estados_con_nota ?? []).includes(state)

/** Mínimo de caracteres de la nota. */
export const minimumNote = (meta) => meta?.nota_minima ?? 10

/** Problema de la nota para pasar a un estado, o `null` si está bien. */
export function noteProblem(state, note, meta) {
  if (!requiresNote(state, meta)) return null
  const minimum = minimumNote(meta)
  return String(note ?? '').trim().length < minimum ? `Explica el motivo (mínimo ${minimum} caracteres).` : null
}

/** Nombre del estado a partir del catálogo de metadatos. */
export const stateName = (code, meta) => (meta?.estados ?? []).find((item) => item.codigo === code)?.nombre ?? code

/** Texto de la confirmación previa de un cambio de estado. */
export function stateConfirmation(guide, state, meta) {
  const extra = state === 'ANULADA' ? ' La guía deja de estar vigente.' : ''
  return `¿Pasar la guía ${guide.numero_guia || `#${guide.id}`} de «${guide.estado_nombre}» a «${stateName(state, meta)}»?${extra}`
}

/** Texto del enfriamiento del rastreo: «Espera 2 min para volver a consultar.». */
export function cooldownText(seconds) {
  const total = Math.max(0, Math.ceil(Number(seconds) || 0))
  if (total === 0) return 'Ya puedes volver a consultar.'
  if (total < 60) return `Espera ${total} s para volver a consultar.`
  return `Espera ${Math.ceil(total / 60)} min para volver a consultar.`
}

/** Texto de la cuota de rastreo: «Cuota de rastreo: 38 restantes de 50». `null` si el servidor no la informó. */
export function quotaText(status) {
  if (!status || status.restante == null || status.total == null) return null
  return `Cuota de rastreo: ${status.restante} restantes de ${status.total}`
}

/** `true` si la cuota está en reserva o agotada (conviene avisar antes de consultar). */
export const quotaLow = (status) => Boolean(status && status.restante != null && status.reserva != null && status.restante <= status.reserva)

/** Si se puede mostrar el botón «Consultar estado»: la guía lo soporta, el usuario gestiona y la guía no está en un estado final. */
export function canTrack(guide, canManage) {
  return Boolean(canManage && guide?.vigente && guide?.rastreo?.soportado && !['ENTREGADA', 'DEVUELTA', 'ANULADA'].includes(guide.estado))
}

/** Si se puede registrar la devolución en cartera: guía DEVUELTA con la factura por cobrar y permiso. */
export const canRegisterReturn = (guide, canReturn) => Boolean(canReturn && guide?.estado === 'DEVUELTA' && guide?.estado_cobro === 'POR_COBRAR')

/** Si una guía entregada espera que se confirme el pago (se avisa en cartera). */
export const deliveredAwaitingPayment = (guide) => Boolean(guide && guide.estado === 'ENTREGADA' && guide.estado_cobro === 'POR_COBRAR')

/** Facturas sin guía agrupadas por urgencia, cada grupo con las más antiguas primero. */
export function groupPending(rows) {
  const groups = { vencida: [], atencion: [], normal: [] }
  for (const row of rows ?? []) (groups[row.urgencia] ?? groups.normal).push(row)
  for (const list of Object.values(groups)) list.sort((a, b) => (b.horas_sin_guia ?? 0) - (a.horas_sin_guia ?? 0))
  return groups
}

/** Cuenta de facturas sin guía por urgencia. */
export function pendingCounts(rows) {
  const groups = groupPending(rows)
  return { total: (rows ?? []).length, vencidas: groups.vencida.length, atencion: groups.atencion.length, normales: groups.normal.length }
}

/** Facturas sin guía, de la más antigua a la más reciente. */
export const sortPending = (rows) => [...(rows ?? [])].sort((a, b) => (b.horas_sin_guia ?? 0) - (a.horas_sin_guia ?? 0))

/** Cuerpo del POST que anota la guía de una factura. */
export const guideBody = (carrier, number) => ({ transportadora: carrier, numero_guia: String(number ?? '').trim() })

/** Problemas del formulario rápido de guía (vacío si está listo). */
export function guideProblems(carrier, number) {
  const problems = []
  if (!carrier) problems.push('Elige la transportadora.')
  if (!String(number ?? '').trim()) problems.push('Escribe el número de guía.')
  return problems
}

/** Cuerpo del POST de la relación de despacho. */
export function dispatchBody({ carrier, guideIds, token, date, responsible, notes }) {
  const body = {
    transportadora: carrier,
    guias: [...guideIds],
    token,
    responsable: String(responsible ?? '').trim(),
    observaciones: String(notes ?? '').trim(),
  }
  if (date) body.fecha = date
  return body
}

/** Motivos por los que todavía no se puede crear la relación: al menos una guía y todas de la misma transportadora. */
export function dispatchProblems({ carrier, selected, responsible }) {
  const problems = []
  if (!carrier) problems.push('Elige la transportadora.')
  if (!selected.length) problems.push('Marca al menos una guía.')
  else if (new Set(selected.map((guide) => guide.transportadora)).size > 1 || (carrier && selected.some((guide) => guide.transportadora !== carrier))) {
    problems.push('Todas las guías de la relación deben ser de la misma transportadora.')
  }
  if (!String(responsible ?? '').trim()) problems.push('Escribe quién entrega los paquetes a la transportadora.')
  return problems
}

/** Texto de la confirmación previa de la relación: pasa las guías a «En tránsito» y no se deshace. */
export function dispatchConfirmation(carrierName, selected) {
  const invoices = selected.map((guide) => guide.factura_numero).join(', ')
  return `Vas a despachar ${selected.length} guía(s) con ${carrierName}:\n${invoices}\n\nLas guías pasan a «En tránsito» y se genera la relación con su PDF. ¿Crear la relación y despachar?`
}

/** Guías por despachar de una transportadora. */
export const dispatchable = (guides, carrier) => (guides ?? []).filter((guide) => guide.estado === 'POR_DESPACHAR' && guide.vigente !== false && guide.transportadora === carrier)

/** Quita o agrega un id de la selección (conjunto como arreglo, sin duplicados). */
export const toggleId = (ids, id) => (ids.includes(id) ? ids.filter((item) => item !== id) : [...ids, id])

/** Mensaje de un error de la API de rastreo que no es fatal: enfriamiento (429), servicio caído (503) o petición rechazada (400). */
export function trackingMessage(failure) {
  const body = failure?.body
  const first = (value) => (Array.isArray(value) ? first(value[0]) : typeof value === 'string' ? value : null)
  if (failure?.status === 429) return [first(body?.detail) ?? failure.message, body?.segundos != null ? cooldownText(body.segundos) : null].filter(Boolean).join(' ')
  if (failure?.status === 503) return first(body?.detail) ?? 'El servicio de rastreo no está disponible. La guía no cambió.'
  if (failure?.status === 400 && body && typeof body === 'object') {
    const key = Object.keys(body)[0]
    return first(body[key]) ?? failure.message
  }
  return null
}

/** Suma el flete de las devoluciones por vendedor. */
export const totalFreight = (rows) => (rows ?? []).reduce((total, row) => total + (Number(row.flete) || 0), 0)

/** Texto del aviso de entregadas por cobrar. */
export function deliveredNotice(count) {
  if (!count) return ''
  return count === 1 ? '1 guía entregada espera confirmar el pago.' : `${count} guías entregadas esperan confirmar el pago.`
}
