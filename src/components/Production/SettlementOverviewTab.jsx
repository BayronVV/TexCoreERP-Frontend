import React from 'react'
import { formatDuration } from './lotTracking'
import { parseCostingSummary, buildDistributionSeries, formatPercentage, formatPesos, settlementStatus } from './costSettlement'
import styles from './Settlement.module.css'

/**
 * Pestaña «Comparativa & Resumen»: totales, costo por prenda, distribución entre materiales y mano de obra, mano de obra por etapa
 * y costo de cada lote.
 * @param {{ costosData: object }} props Respuesta completa de `/costos/` de la orden.
 */
export default function SettlementOverviewTab({ costosData }) {
  const summary = parseCostingSummary(costosData)
  const series = buildDistributionSeries(summary)
  const status = settlementStatus(summary)

  const orden = costosData?.orden || {}
  const manoObra = costosData?.mano_obra || {}
  const porEtapa = manoObra.por_etapa || []
  const porLote = manoObra.por_lote || []

  const pctMat = summary.materialesPct
  const pctMo = summary.manoObraPct

  // Cálculo SVG Donut
  const radius = 60
  const circumference = 2 * Math.PI * radius
  const strokeMat = (pctMat / 100) * circumference
  const strokeMo = (pctMo / 100) * circumference
  const offsetMat = 0
  const offsetMo = -strokeMat

  return (
    <div className={styles.overviewSection}>
      {/* Tarjeta de Balance: Materiales vs Mano de Obra */}
      <section className={styles.comparativeCard}>
        <div className={styles.comparativeHead}>
          <div>
            <h2 className={styles.comparativeTitle}>Balance de Costos: Materiales vs Mano de Obra</h2>
            <p className={styles.comparativeSubtitle}>
              Distribución porcentual de los costos directos de la orden de producción ({orden.cantidad || 0} prendas).
            </p>
          </div>
          <div className={styles.legendItem}>
            <span className={`${styles.statusPill} ${styles[status.pill]}`}>Costeo {status.label.toLowerCase()}</span>
          </div>
        </div>

        {/* Barra de Distribución Proporcional */}
        <div className={styles.distributionBarWrap}>
          <div className={styles.distributionBarTrack} role="progressbar" aria-label="Distribución de Costos">
            <div
              className={styles.barSegmentMat}
              style={{ width: `${pctMat}%` }}
              title={`Materiales: ${formatPercentage(pctMat)} (${formatPesos(parseFloat(summary.totalMateriales))})`}
            />
            <div
              className={styles.barSegmentMo}
              style={{ width: `${pctMo}%` }}
              title={`Mano de Obra: ${formatPercentage(pctMo)} (${formatPesos(parseFloat(summary.totalManoObra))})`}
            />
          </div>

          <div className={styles.distributionLegend}>
            {series.map((item) => (
              <div key={item.key} className={styles.legendItem}>
                <span className={styles.legendDot} style={{ backgroundColor: item.color }} />
                <span className={styles.legendName}>{item.label}:</span>
                <span className={styles.legendPct}>{item.formattedPct}</span>
                <span className={styles.legendValue}>({item.formattedAmount})</span>
              </div>
            ))}
          </div>
        </div>

        {/* Gráfico Circular y Desglose por Etapa */}
        <div className={styles.chartsGrid}>
          <div className={styles.donutSvgWrap}>
            <svg viewBox="0 0 160 160" className={styles.donutSvg} aria-hidden="true">
              <circle
                cx="80"
                cy="80"
                r={radius}
                className={styles.donutBg}
                fill="none"
                strokeWidth="20"
              />
              <circle
                cx="80"
                cy="80"
                r={radius}
                className={styles.donutSegmentMat}
                fill="none"
                strokeWidth="20"
                strokeDasharray={`${strokeMat} ${circumference}`}
                strokeDashoffset={offsetMat}
              />
              <circle
                cx="80"
                cy="80"
                r={radius}
                className={styles.donutSegmentMo}
                fill="none"
                strokeWidth="20"
                strokeDasharray={`${strokeMo} ${circumference}`}
                strokeDashoffset={offsetMo}
              />
            </svg>
            <div className={styles.donutCenterLabel}>
              <small>Total liquidado</small>
              <strong>{formatPesos(parseFloat(summary.granTotal))}</strong>
            </div>
          </div>

          <div className={styles.stageSummaryCard}>
            <h3 className={styles.stageSummaryTitle}>Mano de Obra por Etapa Productiva</h3>
            <table className={styles.compactTable}>
              <thead>
                <tr>
                  <th>Etapa</th>
                  <th>Tiempo Neto Total</th>
                  <th className={styles.colMoney}>Costo Acumulado</th>
                </tr>
              </thead>
              <tbody>
                {porEtapa.map((st) => (
                  <tr key={st.etapa}>
                    <td>
                      <span className={styles.stageTag}>{st.etapa_nombre || st.etapa}</span>
                    </td>
                    <td>{formatDuration(st.segundos_netos || 0)}</td>
                    <td className={styles.colMoney}>
                      <strong>{formatPesos(parseFloat(st.costo || 0))}</strong>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* Prorrateo de Materiales y Costo por Lote */}
      <section className={styles.tableCard}>
        <div className={styles.tableToolbar}>
          <div className={styles.toolbarTitleBox}>
            <h2>Prorrateo de Materiales y Costo por Lote</h2>
            <p>
              El material de la orden se asigna a cada lote en proporción a sus prendas (total materiales × prendas lote / prendas orden).
            </p>
          </div>
        </div>

        <div className={styles.tableContainer}>
          <table className={styles.dataTable}>
            <thead>
              <tr>
                <th>Lote</th>
                <th>Prendas</th>
                <th className={styles.colMoney}>Materiales Asignados</th>
                <th className={styles.colMoney}>Mano de Obra Lote</th>
                <th className={styles.colMoney}>Costo Total Lote</th>
              </tr>
            </thead>
            <tbody>
              {porLote.map((lote) => {
                const matVal = parseFloat(lote.materiales_asignados || 0)
                const moVal = parseFloat(lote.total || 0)
                const lotTotal = matVal + moVal

                return (
                  <tr key={lote.lote}>
                    <td>
                      <strong>{lote.codigo}</strong>
                    </td>
                    <td>{lote.cantidad} und</td>
                    <td className={styles.colMoney}>{formatPesos(matVal)}</td>
                    <td className={styles.colMoney}>{formatPesos(moVal)}</td>
                    <td className={styles.colMoney}>
                      <strong className={styles.totalHighlight}>{formatPesos(lotTotal)}</strong>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}
