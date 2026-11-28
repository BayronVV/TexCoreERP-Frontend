// Trazabilidad de punta a punta (HU 7.6, TE-176): rutas, permisos y textos de la pantalla.
// El servidor arma cada bloque solo si el rol tiene el permiso de consulta de su módulo; aquí solo se presenta.

/** Basta con uno de estos permisos de consulta para abrir la pantalla (igual que en el backend). */
export const TRACE_PERMISSIONS = [
  'calidad.ver',
  'compras.ver',
  'envios.ver',
  'fichas_tecnicas.ver',
  'inventario.ver',
  'lavanderia.ver',
  'produccion.ver',
  'producto_terminado.ver',
  'referencias.ver',
  'ventas.ver',
]

const enc = encodeURIComponent

/** Ruta de la ficha de trazabilidad de un lote o de una factura. */
export function tracePath(tipo, codigo) {
  if (!codigo) return '/trazabilidad'
  return tipo === 'factura' ? `/trazabilidad/factura/${enc(codigo)}` : `/trazabilidad/lote/${enc(codigo)}`
}

/** Pantallas de origen de cada paso: cada enlace lleva a donde el dato se registra. */
export const ORIGIN = {
  orden: (codigo) => `/produccion/ordenes?q=${enc(codigo)}`,
  etapas: (lote) => `/produccion/monitor?q=${enc(lote)}`,
  materiales: () => '/inventario?tab=historial',
  ordenCompra: (codigo) => `/compras/ordenes?orden=${enc(codigo)}`,
  remision: () => '/lavanderia/remisiones',
  recepcion: () => '/lavanderia/recepcion',
  inspeccion: (codigo) => `/calidad/inspecciones?q=${enc(codigo)}`,
  ingreso: (lote) => `/producto-terminado/movimientos?q=${enc(lote)}`,
  referencia: () => '/referencias',
  factura: (numero) => `/ventas/facturas?q=${enc(numero)}`,
  movimientos: (numero) => `/producto-terminado/movimientos?q=${enc(numero)}`,
  guia: (numero) => `/envios/guias?q=${enc(numero)}`,
  cartera: (numero) => `/ventas/cartera?tab=TODAS&q=${enc(numero)}`,
}

/** Número entero legible (`1.250`). */
export function formatUnits(value) {
  if (value === null || value === undefined || value === '') return '—'
  return new Intl.NumberFormat('es-CO', { maximumFractionDigits: 2 }).format(Number(value))
}

/** Fecha (AAAA-MM-DD o ISO) en formato local corto: «15 oct 2026». */
export function formatDay(value) {
  if (!value) return '—'
  const text = String(value)
  const date = /^\d{4}-\d{2}-\d{2}$/.test(text) ? new Date(`${text}T12:00:00`) : new Date(text)
  return date.toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' })
}

/** Duración en segundos como «2 h 05 min», «45 min» o «—». */
export function formatDuration(seconds) {
  const total = Number(seconds)
  if (!Number.isFinite(total) || total <= 0) return '—'
  const hours = Math.floor(total / 3600)
  const minutes = Math.round((total % 3600) / 60)
  if (!hours) return `${minutes} min`
  return `${hours} h ${String(minutes).padStart(2, '0')} min`
}

/**
 * Cómo se muestra un paso de la franja de conciliación.
 * - `sin-acceso`: el rol no ve ese módulo.
 * - `pendiente`: todavía no hay registro.
 * - `alerta`: la diferencia con el paso anterior no la explica ningún registro (o hay más prendas que antes).
 * - `ok`: cuadra, o la diferencia está justificada (merma, dañadas o marras registradas).
 *
 * @param {{acceso: boolean, pendiente?: boolean, diferencia?: number, sin_justificar?: number}} step
 */
export function stepStatus(step) {
  if (!step?.acceso) return 'sin-acceso'
  if (step.pendiente) return 'pendiente'
  if (step.diferencia !== undefined && step.sin_justificar !== 0) return 'alerta'
  return 'ok'
}

/** Texto de la diferencia de un paso frente al anterior, o `''` si no se compara. */
export function differenceText(step) {
  if (step?.diferencia === undefined) return ''
  const { diferencia, porcentaje, justificada, sin_justificar: unexplained } = step
  if (diferencia === 0) return 'Cuadra con el paso anterior'
  if (diferencia < 0) return `${formatUnits(-diferencia)} más que el paso anterior: sin justificar`
  const pct = `${String(porcentaje).replace('.', ',')} %`
  if (!unexplained) return `−${formatUnits(diferencia)} (${pct}), justificadas por lo registrado`
  if (!justificada) return `−${formatUnits(diferencia)} (${pct}) sin justificar`
  return `−${formatUnits(diferencia)} (${pct}): ${formatUnits(justificada)} justificadas y ${formatUnits(unexplained)} sin justificar`
}

/** Mensaje para el resultado de una búsqueda que no lleva directo a una ficha. */
export function searchMessage(result) {
  if (!result) return ''
  if (!result.tipo) return result.codigo ? `No encontramos ningún registro con el código «${result.codigo}».` : 'Escribe un código.'
  if (result.tipo === 'orden') return `La orden ${result.codigo} tiene ${result.opciones.length} lotes: elige uno.`
  if (result.tipo === 'relacion') {
    return result.opciones.length
      ? `La relación ${result.codigo} tiene ${result.opciones.length} guías: elige la factura.`
      : `La relación ${result.codigo} no tiene guías.`
  }
  return ''
}
