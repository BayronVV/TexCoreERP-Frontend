/**
 * Lógica pura de presentación y cálculo para la liquidación de costos de órdenes (HU 4.6 / TE-127, TE-128).
 * Funciones puras probadas con node --test, sin dependencias de React ni del DOM.
 */

import { formatMoney } from '../Inventory/money.js'
import { formatDuration } from './lotTracking.js'

/**
 * Formatea un porcentaje numérico o en texto a formato legible con símbolo %.
 * @param {number|string|null|undefined} pct
 * @returns {string}
 */
export function formatPercentage(pct) {
  if (pct === null || pct === undefined || pct === '') return '0,00%'
  const num = typeof pct === 'number' ? pct : parseFloat(String(pct).replace(',', '.'))
  if (isNaN(num)) return '0,00%'
  return `${num.toLocaleString('es-CO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%`
}

/**
 * Extrae los KPIs y totales principales a partir de la respuesta del endpoint de costos.
 * @param {object} costosData - Respuesta de GET /api/produccion/ordenes/<id>/costos/
 * @returns {object}
 */
export function parseCostingSummary(costosData) {
  if (!costosData || typeof costosData !== 'object') {
    return {
      isValid: false,
      completo: false,
      anulada: false,
      advertencias: [],
      totalMateriales: '0',
      totalManoObra: '0',
      granTotal: '0',
      costoPorPrenda: '0',
      materialesPct: 0,
      manoObraPct: 0,
      prendas: 0,
    }
  }

  const orden = costosData.orden || {}
  const totales = costosData.totales || {}
  const distribucion = costosData.distribucion || {}

  const matPct = parseFloat(String(distribucion.materiales_pct || '0').replace(',', '.')) || 0
  const moPct = parseFloat(String(distribucion.mano_obra_pct || '0').replace(',', '.')) || 0

  return {
    isValid: true,
    completo: Boolean(costosData.completo),
    anulada: Boolean(orden.anulada),
    advertencias: Array.isArray(costosData.advertencias) ? costosData.advertencias : [],
    totalMateriales: totales.materiales || '0.00',
    totalManoObra: totales.mano_obra || '0.00',
    granTotal: totales.total || '0.00',
    costoPorPrenda: totales.costo_por_prenda || '0.00',
    materialesPct: matPct,
    manoObraPct: moPct,
    prendas: Number(orden.cantidad || 0),
  }
}

/**
 * Genera la serie de datos para la barra / gráfica de distribución materiales vs mano de obra.
 * @param {object} summary - Resultado de parseCostingSummary
 * @returns {Array<{ key: string, label: string, pct: number, formattedPct: string, formattedAmount: string, color: string }>}
 */
export function buildDistributionSeries(summary) {
  if (!summary || !summary.isValid) return []

  const totalMat = parseFloat(summary.totalMateriales) || 0
  const totalMo = parseFloat(summary.totalManoObra) || 0

  return [
    {
      key: 'materiales',
      label: 'Materiales e insumos',
      pct: summary.materialesPct,
      formattedPct: formatPercentage(summary.materialesPct),
      formattedAmount: formatMoney(totalMat),
      color: '#0d9488', // teal-600
      barClass: 'distributionBarMaterials',
    },
    {
      key: 'mano_obra',
      label: 'Mano de obra (MOD)',
      pct: summary.manoObraPct,
      formattedPct: formatPercentage(summary.manoObraPct),
      formattedAmount: formatMoney(totalMo),
      color: '#f59e0b', // amber-500
      barClass: 'distributionBarLabor',
    },
  ]
}

/**
 * Prepara las líneas de material con formato y etiquetas para la tabla de materiales.
 * @param {Array<object>} lineas - lineas de materiales del servidor
 * @returns {Array<object>}
 */
export function prepareMaterialRows(lineas) {
  if (!Array.isArray(lineas)) return []

  return lineas.map((line, index) => {
    const unitCost = line.costo_unitario !== null && line.costo_unitario !== undefined
      ? formatMoney(parseFloat(line.costo_unitario))
      : 'Sin costo'
    const totalCost = formatMoney(parseFloat(line.costo || 0))

    return {
      id: line.producto || `mat-${index}`,
      codigo: line.codigo || '—',
      nombre: line.nombre || 'Material desconocido',
      unidad: line.unidad || 'und',
      cantidad: line.cantidad || '0',
      costoUnitarioFormatted: unitCost,
      subtotalFormatted: totalCost,
      sinCosto: Boolean(line.sin_costo),
      statusBadge: line.sin_costo ? 'Sin costo' : 'Costeado',
      statusClass: line.sin_costo ? 'badgeWarning' : 'badgeSuccess',
    }
  })
}

/**
 * Prepara los lotes y sus etapas para la vista de mano de obra.
 * @param {Array<object>} lotes - por_lote del servidor
 * @returns {Array<object>}
 */
export function prepareLaborLots(lotes) {
  if (!Array.isArray(lotes)) return []

  return lotes.map((lote) => {
    const etapasFormatted = (lote.etapas || []).map((etapa) => {
      const rateText = etapa.tarifa_minuto !== null && etapa.tarifa_minuto !== undefined
        ? `${formatMoney(parseFloat(etapa.tarifa_minuto))}/min`
        : 'Sin tarifa'

      return {
        etapa: etapa.etapa,
        nombre: etapa.etapa_nombre || etapa.etapa,
        estado: etapa.estado,
        tiempoFormatted: formatDuration(etapa.segundos_netos || 0),
        segundosNetos: etapa.segundos_netos || 0,
        tarifaFormatted: rateText,
        costoFormatted: formatMoney(parseFloat(etapa.costo || 0)),
        sinTarifa: Boolean(etapa.sin_tarifa),
        provisional: Boolean(etapa.provisional),
      }
    })

    return {
      loteId: lote.lote,
      codigo: lote.codigo,
      cantidad: lote.cantidad,
      materialesAsignadosFormatted: formatMoney(parseFloat(lote.materiales_asignados || 0)),
      totalManoObraFormatted: formatMoney(parseFloat(lote.total || 0)),
      etapas: etapasFormatted,
    }
  })
}
