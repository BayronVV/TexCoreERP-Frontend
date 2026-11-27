import * as XLSX from 'xlsx'

/** Pestañas del tablero gerencial: `id` (clave del reporte) y `label` (texto visible). */
export const REPORT_TABS = [
  { id: 'consolidado', label: 'Consolidado por Tipo de Jean' },
  { id: 'produccion', label: 'Órdenes de Producción' },
  { id: 'ventas_ref', label: 'Ventas por Referencia' },
  { id: 'ventas_det', label: 'Detalle de Ventas' },
  { id: 'devoluciones', label: 'Devoluciones por vendedor' },
]

/** Claves de los filtros soportados por `GET /api/reportes/gerencial/`. */
export const REPORT_FILTER_KEYS = [
  'desde',
  'hasta',
  'tipo_jean',
  'referencia',
  'estado_orden',
  'estado_cobro',
  'tipo_cliente',
  'vendedor',
  'transportadora',
]

/** Filtros avanzados vacíos del tablero; las claves son los parámetros de `GET /api/reportes/gerencial/`. */
export const INITIAL_FILTERS = {
  desde: '',
  hasta: '',
  tipo_jean: '',
  referencia: '',
  estado_orden: '',
  estado_cobro: '',
  tipo_cliente: '',
  vendedor: '',
  transportadora: '',
}

/**
 * Dinero en pesos con separador de miles local (`es-CO`).
 * @param {number|string} value Valor numérico (lo no numérico cuenta como cero).
 * @returns {string} Por ejemplo `$1.250.000`.
 */
export const money = (value) => `$${Number(value || 0).toLocaleString('es-CO')}`

/**
 * Número con separador de miles local (`es-CO`).
 * @param {number|string} value Valor numérico (lo no numérico cuenta como cero).
 * @returns {string}
 */
export const number = (value) => Number(value || 0).toLocaleString('es-CO')

/**
 * Fecha calendario actual (`YYYY-MM-DD`) en zona horaria de Colombia (`America/Bogota`, UTC-5).
 * Evita que después de las 7:00 p. m. COT se adelante un día al usar `toISOString()`.
 */
export function colombiaTodayISO(now = new Date()) {
  const parts = new Intl.DateTimeFormat('en', {
    timeZone: 'America/Bogota',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now)
  const map = Object.fromEntries(parts.map((part) => [part.type, part.value]))
  return `${map.year}-${map.month}-${map.day}`
}

/**
 * Suma o resta días calendario sobre una fecha ISO `YYYY-MM-DD` sin verse afectado por huso local o DST.
 */
export function shiftIsoDays(isoDate, deltaDays) {
  const [y, m, d] = isoDate.split('-').map(Number)
  const dt = new Date(Date.UTC(y, m - 1, d + Number(deltaDays || 0)))
  const year = dt.getUTCFullYear()
  const month = String(dt.getUTCMonth() + 1).padStart(2, '0')
  const day = String(dt.getUTCDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

/**
 * Calcula los rangos rápidos del tablero (`7`, `30`, `'month'`, o `null`) usando la hora de Colombia.
 */
export function quickRangeDates(preset, now = new Date()) {
  if (preset === null || preset === undefined || preset === '') {
    return { desde: '', hasta: '' }
  }
  const end = colombiaTodayISO(now)
  if (preset === 'month') {
    return { desde: `${end.slice(0, 7)}-01`, hasta: end }
  }
  return { desde: shiftIsoDays(end, -Number(preset)), hasta: end }
}

/**
 * Construye el query string limpio a partir del estado de filtros avanzados.
 */
export function buildReportQueryParams(filters = {}) {
  const params = new URLSearchParams()
  for (const key of REPORT_FILTER_KEYS) {
    const val = String(filters[key] ?? '').trim()
    if (val) {
      params.set(key, val)
    }
  }
  const qs = params.toString()
  return qs ? `?${qs}` : ''
}

/**
 * Cuenta cuántos filtros avanzados están activos.
 */
export function activeFilterCount(filters = {}) {
  return REPORT_FILTER_KEYS.filter(
    (key) => String(filters[key] ?? '').trim() !== '',
  ).length
}

/**
 * Filtra las referencias disponibles en el selector según el tipo de jean (silueta) elegido.
 */
export function filterReferencesByJeanType(referencias = [], tipoJean = '') {
  if (!tipoJean) return referencias
  return referencias.filter((ref) => ref.ajuste === tipoJean)
}

/**
 * Definición de columnas exportables para cada vista del tablero gerencial.
 */
export const EXPORT_SCHEMAS = {
  consolidado: {
    sheetName: 'Por Tipo de Jean',
    filePrefix: 'reporte_consolidado_jean',
    columns: [
      { header: 'Tipo de Jean (Silueta)', get: (r) => r.tipo_jean_nombre || r.tipo_jean },
      { header: 'Órdenes de Producción', get: (r) => Number(r.ordenes_count || 0) },
      { header: 'Prendas Planificadas', get: (r) => Number(r.prendas_planificadas || 0) },
      { header: 'Prendas Aptas (1ra)', get: (r) => Number(r.prendas_aptas || 0) },
      { header: 'Marras / Defectos', get: (r) => Number(r.prendas_marras || 0) },
      { header: 'Unidades Vendidas', get: (r) => Number(r.unidades_vendidas || 0) },
      { header: 'Ingresos por Ventas ($)', get: (r) => Number(r.ingresos_totales || 0) },
      { header: 'Utilidad Bruta Estimada ($)', get: (r) => Number(r.utilidad_bruta || 0) },
    ],
  },
  produccion: {
    sheetName: 'Ordenes Produccion',
    filePrefix: 'reporte_ordenes_produccion',
    columns: [
      { header: 'Código Orden', get: (r) => r.codigo },
      { header: 'Fecha Salida', get: (r) => r.fecha_salida },
      { header: 'Estado de Orden', get: (r) => r.estado_orden_nombre || r.estado_orden },
      { header: 'Código Referencia', get: (r) => r.referencia_codigo },
      { header: 'Referencia', get: (r) => r.referencia_nombre },
      { header: 'Tipo de Jean', get: (r) => r.tipo_jean_nombre || r.tipo_jean },
      { header: 'Responsable', get: (r) => r.responsable },
      { header: 'Prendas Planificadas', get: (r) => Number(r.prendas_planificadas || 0) },
      { header: 'Lotes Creados', get: (r) => Number(r.total_lotes || 0) },
      { header: 'Prendas en Lotes', get: (r) => Number(r.prendas_en_lotes || 0) },
      { header: 'Prendas Aptas', get: (r) => Number(r.prendas_aptas || 0) },
      { header: 'Prendas Marras', get: (r) => Number(r.prendas_marras || 0) },
      { header: 'Calidad (%)', get: (r) => Number(r.tasa_calidad_pct || 0) },
    ],
  },
  ventas_ref: {
    sheetName: 'Ventas por Referencia',
    filePrefix: 'reporte_ventas_referencias',
    columns: [
      { header: 'Código Referencia', get: (r) => r.referencia_codigo },
      { header: 'Nombre Referencia', get: (r) => r.referencia_nombre },
      { header: 'Tipo de Jean', get: (r) => r.tipo_jean_nombre || r.tipo_jean },
      { header: 'Facturas Emitidas', get: (r) => Number(r.facturas_count || 0) },
      { header: 'Unidades Vendidas', get: (r) => Number(r.unidades_vendidas || 0) },
      { header: 'Subtotal Bruto ($)', get: (r) => Number(r.subtotal_bruto || 0) },
      { header: 'Descuentos ($)', get: (r) => Number(r.descuento_total || 0) },
      { header: 'Base Gravable ($)', get: (r) => Number(r.base_gravable || 0) },
      { header: 'IVA ($)', get: (r) => Number(r.iva_total || 0) },
      { header: 'Total Facturado ($)', get: (r) => Number(r.ingresos_totales || 0) },
      { header: 'Costo Fábrica Estimado ($)', get: (r) => Number(r.costo_estimado || 0) },
      { header: 'Utilidad Bruta ($)', get: (r) => Number(r.utilidad_bruta || 0) },
      { header: 'Margen (%)', get: (r) => Number(r.margen_pct || 0) },
    ],
  },
  ventas_det: {
    sheetName: 'Detalle Ventas',
    filePrefix: 'reporte_detalle_ventas',
    columns: [
      { header: 'Factura', get: (r) => r.numero_factura },
      { header: 'Fecha', get: (r) => r.fecha },
      { header: 'Cliente', get: (r) => r.cliente_nombre },
      { header: 'Tipo Cliente', get: (r) => r.cliente_tipo_nombre || r.cliente_tipo },
      { header: 'Vendedor', get: (r) => r.vendedor_nombre || '' },
      { header: 'Transportadora', get: (r) => r.transportadora || '' },
      { header: 'Estado Cobro', get: (r) => r.estado_cobro_nombre || r.estado_cobro },
      { header: 'Referencia', get: (r) => `${r.referencia_codigo} · ${r.referencia_nombre}` },
      { header: 'Tipo de Jean', get: (r) => r.tipo_jean_nombre || r.tipo_jean },
      { header: 'Talla', get: (r) => r.talla },
      { header: 'Color', get: (r) => r.color },
      { header: 'Unidades', get: (r) => Number(r.unidades || 0) },
      { header: 'Base Gravable ($)', get: (r) => Number(r.base_gravable || 0) },
      { header: 'IVA ($)', get: (r) => Number(r.iva || 0) },
      { header: 'Total ($)', get: (r) => Number(r.total || 0) },
    ],
  },
  devoluciones: {
    sheetName: 'Devoluciones Vendedor',
    filePrefix: 'reporte_devoluciones_vendedor',
    columns: [
      { header: 'Vendedor', get: (r) => r.vendedor_nombre || 'Sin vendedor' },
      { header: 'Guías Devueltas', get: (r) => Number(r.guias_devueltas || 0) },
      { header: 'Flete a Cargo ($)', get: (r) => Number(r.flete_vendedor || 0) },
    ],
  },
}

/**
 * Obtiene el arreglo de filas visibles según la pestaña activa del tablero.
 */
export function getActiveTabRows(reportData, activeTab) {
  if (!reportData) return []
  switch (activeTab) {
    case 'consolidado':
      return reportData.consolidado_tipo_jean || []
    case 'produccion':
      return reportData.ordenes_produccion || []
    case 'ventas_ref':
      return reportData.ventas_por_referencia || []
    case 'ventas_det':
      return reportData.ventas_detalle || []
    case 'devoluciones':
      return reportData.devoluciones_por_vendedor || []
    default:
      return []
  }
}

/**
 * Transforma un conjunto de filas y un esquema de columnas en una matriz 2D (encabezados + datos)
 * lista para ser exportada con SheetJS (`XLSX.utils.aoa_to_sheet`) o convertida a CSV.
 */
export function buildExportMatrix(rows = [], columns = []) {
  const headerRow = columns.map((col) => col.header)
  const dataRows = rows.map((row) =>
    columns.map((col) => {
      const value = col.get(row)
      return value === undefined || value === null ? '' : value
    }),
  )
  return [headerRow, ...dataRows]
}

/**
 * Genera el contenido CSV (con BOM UTF-8 para que Excel en español reconozca tildes y ñ)
 * a partir de una matriz de exportación.
 */
export function matrixToCsvString(matrix = []) {
  const escapeCell = (cell) => {
    const str = String(cell ?? '')
    if (str.includes(',') || str.includes(';') || str.includes('"') || str.includes('\n')) {
      return `"${str.replace(/"/g, '""')}"`
    }
    return str
  }
  const lines = matrix.map((row) => row.map(escapeCell).join(','))
  return `\uFEFF${lines.join('\r\n')}`
}

/**
 * Exporta los datos visibles de la pestaña actual a un archivo CSV desde el navegador.
 */
export function exportTabToCsv(reportData, activeTab, dateStamp = '') {
  const schema = EXPORT_SCHEMAS[activeTab] || EXPORT_SCHEMAS.consolidado
  const rows = getActiveTabRows(reportData, activeTab)
  const matrix = buildExportMatrix(rows, schema.columns)
  const worksheet = XLSX.utils.aoa_to_sheet(matrix)
  const csvContent = `\uFEFF${XLSX.utils.sheet_to_csv(worksheet)}`

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  const suffix = dateStamp ? `_${dateStamp}` : ''
  link.href = url
  link.setAttribute('download', `${schema.filePrefix}${suffix}.csv`)
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

/**
 * Exporta el tablero gerencial a un libro de Excel (.xlsx) usando SheetJS:
 * Incluye la hoja de la pestaña activa en primer lugar y las demás hojas analíticas del reporte.
 */
export function exportReportToExcel(reportData, activeTab = 'consolidado', dateStamp = '') {
  const workbook = XLSX.utils.book_new()
  const tabOrder = [
    activeTab,
    ...Object.keys(EXPORT_SCHEMAS).filter((key) => key !== activeTab),
  ]

  for (const tabKey of tabOrder) {
    const schema = EXPORT_SCHEMAS[tabKey]
    if (!schema) continue
    const rows = getActiveTabRows(reportData, tabKey)
    const matrix = buildExportMatrix(rows, schema.columns)
    const worksheet = XLSX.utils.aoa_to_sheet(matrix)
    worksheet['!cols'] = schema.columns.map((col) => ({
      wch: Math.max(col.header.length + 4, 14),
    }))
    XLSX.utils.book_append_sheet(workbook, worksheet, schema.sheetName)
  }

  const activeSchema = EXPORT_SCHEMAS[activeTab] || EXPORT_SCHEMAS.consolidado
  const suffix = dateStamp ? `_${dateStamp}` : ''
  XLSX.writeFile(workbook, `${activeSchema.filePrefix}${suffix}.xlsx`)
}
