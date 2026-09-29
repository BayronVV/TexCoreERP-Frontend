export const PRODUCT_TYPES = [
  { value: 'MATERIA_PRIMA', label: 'Materia prima', plural: 'Materias primas' },
  { value: 'INSUMO', label: 'Insumo', plural: 'Insumos' },
  { value: 'GENERICO', label: 'Pantalón genérico', plural: 'Pantalones genéricos' },
  { value: 'TERMINADO', label: 'Producto terminado', plural: 'Productos terminados' },
]

export const UNITS = [
  { value: 'm', label: 'Metros (m)' },
  { value: 'kg', label: 'Kilogramos (kg)' },
  { value: 'rollo', label: 'Rollos' },
  { value: 'caja', label: 'Cajas' },
  { value: 'unidad', label: 'Unidades' },
]

// Se compran a un proveedor; el resto se fabrica y entra al cerrar una orden.
export const PURCHASED = ['MATERIA_PRIMA', 'INSUMO']
export const WHOLE_UNITS = ['rollo', 'caja', 'unidad']

export const ORDER_TYPES = [
  { value: 'PRODUCCION', label: 'Producción', prefix: 'OP' },
  { value: 'LAVANDERIA', label: 'Lavandería', prefix: 'LV' },
]

export const typeLabel = (value) => PRODUCT_TYPES.find((t) => t.value === value)?.label ?? value

export const formatQty = (value, unit = '') => {
  const number = Number(value)
  const text = Number.isFinite(number) ? number.toLocaleString('es-CO', { maximumFractionDigits: 2 }) : value
  return unit ? `${text} ${unit}` : text
}

export const todayISO = () => {
  const now = new Date()
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60000)
  return local.toISOString().slice(0, 10)
}

export const formatDate = (value) =>
  value ? new Date(`${value}T00:00:00`).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'

// DRF devuelve {campo: [mensaje]}; deja un mapa campo -> primer mensaje.
export function fieldErrors(error) {
  const body = error?.body
  if (!body || typeof body !== 'object' || Array.isArray(body)) return { detail: error?.message }
  const result = {}
  for (const [key, value] of Object.entries(body)) {
    if (key === 'faltantes') continue
    const first = [].concat(value)[0]
    result[key] = typeof first === 'string' ? first : error.message
  }
  return result
}
