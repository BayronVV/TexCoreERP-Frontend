import test from 'node:test'
import assert from 'node:assert/strict'

import {
  formatPercentage,
  parseCostingSummary,
  buildDistributionSeries,
  prepareMaterialRows,
  prepareLaborLots,
} from './costSettlement.js'

test('formatPercentage: formatea valores numéricos y nulos', () => {
  assert.equal(formatPercentage(null), '0,00%')
  assert.equal(formatPercentage(undefined), '0,00%')
  assert.equal(formatPercentage(0), '0,00%')
  assert.equal(formatPercentage(99.11), '99,11%')
  assert.equal(formatPercentage('0.89'), '0,89%')
  assert.equal(formatPercentage('invalido'), '0,00%')
})

test('parseCostingSummary: extrae KPIs y advertencias del objeto de costos', () => {
  const mockPayload = {
    orden: { id: 13, codigo: 'OP-0013', cantidad: 80, anulada: false },
    completo: false,
    advertencias: ['Falta la tarifa de la etapa Terminación.', 'El material Remache no tiene costo.'],
    materiales: { total: '2938233.46' },
    mano_obra: { total: '26250.00' },
    totales: {
      materiales: '2938233.46',
      mano_obra: '26250.00',
      total: '2964483.46',
      costo_por_prenda: '37056.04',
    },
    distribucion: { materiales_pct: '99.11', mano_obra_pct: '0.89' },
  }

  const summary = parseCostingSummary(mockPayload)
  assert.equal(summary.isValid, true)
  assert.equal(summary.completo, false)
  assert.equal(summary.anulada, false)
  assert.equal(summary.advertencias.length, 2)
  assert.equal(summary.totalMateriales, '2938233.46')
  assert.equal(summary.totalManoObra, '26250.00')
  assert.equal(summary.granTotal, '2964483.46')
  assert.equal(summary.costoPorPrenda, '37056.04')
  assert.equal(summary.materialesPct, 99.11)
  assert.equal(summary.manoObraPct, 0.89)
  assert.equal(summary.prendas, 80)
})

test('parseCostingSummary: tolera datos nulos o vacíos', () => {
  const summary = parseCostingSummary(null)
  assert.equal(summary.isValid, false)
  assert.equal(summary.completo, false)
  assert.equal(summary.advertencias.length, 0)
})

test('buildDistributionSeries: genera las dos barras para la gráfica', () => {
  const summary = {
    isValid: true,
    materialesPct: 99.11,
    manoObraPct: 0.89,
    totalMateriales: '2938233.46',
    totalManoObra: '26250.00',
  }

  const series = buildDistributionSeries(summary)
  assert.equal(series.length, 2)
  assert.equal(series[0].key, 'materiales')
  assert.equal(series[0].pct, 99.11)
  assert.equal(series[1].key, 'mano_obra')
  assert.equal(series[1].pct, 0.89)
})

test('prepareMaterialRows: formatea líneas con costos conocidos y faltantes', () => {
  const lines = [
    {
      producto: 1,
      codigo: 'TEL-001',
      nombre: 'Denim 14 oz',
      unidad: 'm',
      cantidad: '120.00',
      costo_unitario: '21365.2174',
      costo: '2563826.09',
      sin_costo: false,
    },
    {
      producto: 2,
      codigo: 'BOT-001',
      nombre: 'Botón 17mm',
      unidad: 'und',
      cantidad: '100',
      costo_unitario: null,
      costo: '0.00',
      sin_costo: true,
    },
  ]

  const rows = prepareMaterialRows(lines)
  assert.equal(rows.length, 2)
  assert.equal(rows[0].sinCosto, false)
  assert.equal(rows[0].costoUnitarioFormatted.includes('$'), true)
  assert.equal(rows[1].sinCosto, true)
  assert.equal(rows[1].costoUnitarioFormatted, 'Sin costo')
  assert.equal(rows[1].statusBadge, 'Sin costo')
})

test('prepareLaborLots: prepara etapas con tiempos y tarifas formateadas', () => {
  const lotes = [
    {
      lote: 101,
      codigo: 'OP-0013-L01',
      cantidad: 30,
      materiales_asignados: '1101837.55',
      etapas: [
        {
          etapa: 'CORTE',
          etapa_nombre: 'Corte',
          estado: 'COMPLETADA',
          segundos_netos: 3300,
          tarifa_minuto: '250.0000',
          costo: '13750.00',
          sin_tarifa: false,
          provisional: false,
        },
      ],
      total: '13750.00',
    },
  ]

  const prepared = prepareLaborLots(lotes)
  assert.equal(prepared.length, 1)
  assert.equal(prepared[0].codigo, 'OP-0013-L01')
  assert.equal(prepared[0].etapas[0].tiempoFormatted, '55 min 00 s')
  assert.equal(prepared[0].etapas[0].tarifaFormatted.includes('/min'), true)
  assert.equal(prepared[0].etapas[0].sinTarifa, false)
  assert.equal(prepared[0].etapas[0].provisional, false)
})
