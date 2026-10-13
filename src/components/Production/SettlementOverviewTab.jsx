import React from 'react'
import styles from './Production.module.css'

/** Formatea montos en pesos colombianos ($ 12.500.000). */
const formatCOP = (val) => {
  const num = Number(val) || 0
  return `$ ${num.toLocaleString('es-CO', { maximumFractionDigits: 0 })}`
}

/** Formatea porcentajes con 1 o 2 decimales. */
const formatPct = (val) => {
  const num = Number(val) || 0
  return `${num.toLocaleString('es-CO', { minimumFractionDigits: 1, maximumFractionDigits: 2 })}%`
}

export default function SettlementOverviewTab({ order }) {
  const { resumen, unidades_primera } = order
  const { materiales, mano_obra, cif, totales } = resumen

  // Porcentajes para la barra visual (normalizados si cif aplica)
  const pctMat = materiales.porcentaje_costo || 60
  const pctMo = mano_obra.porcentaje_costo || 35
  const pctCif = cif.porcentaje_costo || 5

  // Cálculo de circunferencia para el SVG donut
  const radius = 60
  const circumference = 2 * Math.PI * radius
  const strokeMat = (pctMat / 100) * circumference
  const strokeMo = (pctMo / 100) * circumference
  const strokeCif = (pctCif / 100) * circumference

  const offsetMat = 0
  const offsetMo = -strokeMat
  const offsetCif = -(strokeMat + strokeMo)

  return (
    <div className={styles.overviewSection}>
      {/* Tarjeta de Comparativa Principal: Materiales vs Mano de Obra */}
      <section className={styles.comparativeCard}>
        <div className={styles.comparativeHead}>
          <div>
            <h2 className={styles.comparativeTitle}>Balance de Costos: Materiales vs Mano de Obra</h2>
            <p className={styles.comparativeSubtitle}>
              Distribución porcentual de los costos directos e indirectos en la liquidación real de la orden.
            </p>
          </div>
          <div className={styles.legendItem}>
            <span className={`${styles.statusPill} ${totales.variacion > 0 ? styles.pillWarning : styles.pillSuccess}`}>
              Variación Global: {totales.variacion > 0 ? '+' : ''}{formatCOP(totales.variacion)} ({formatPct(totales.variacion_pct)})
            </span>
          </div>
        </div>

        {/* Barra de Distribución Proporcional */}
        <div className={styles.distributionBarWrap}>
          <div className={styles.distributionBarTrack} role="progressbar" aria-label="Distribución de Costos">
            <div
              className={styles.barSegmentMat}
              style={{ width: `${pctMat}%` }}
              title={`Materiales Directos: ${formatPct(pctMat)} (${formatCOP(materiales.real)})`}
            >
              Materiales {formatPct(pctMat)}
            </div>
            <div
              className={styles.barSegmentMo}
              style={{ width: `${pctMo}%` }}
              title={`Mano de Obra Directa: ${formatPct(pctMo)} (${formatCOP(mano_obra.real)})`}
            >
              Mano de Obra {formatPct(pctMo)}
            </div>
            {pctCif > 0 && (
              <div
                className={styles.barSegmentCif}
                style={{ width: `${pctCif}%` }}
                title={`Costos Indirectos (CIF): ${formatPct(pctCif)} (${formatCOP(cif.real)})`}
              >
                CIF {formatPct(pctCif)}
              </div>
            )}
          </div>

          <div className={styles.distributionLegend}>
            <div className={styles.legendItem}>
              <span className={`${styles.legendDot} ${styles.dotMat}`} />
              <span>
                <strong>Materiales Directos:</strong> {formatCOP(materiales.real)} ({formatPct(pctMat)})
              </span>
            </div>
            <div className={styles.legendItem}>
              <span className={`${styles.legendDot} ${styles.dotMo}`} />
              <span>
                <strong>Mano de Obra Directa:</strong> {formatCOP(mano_obra.real)} ({formatPct(pctMo)})
              </span>
            </div>
            <div className={styles.legendItem}>
              <span className={`${styles.legendDot} ${styles.dotCif}`} />
              <span>
                <strong>Costos Indirectos (CIF):</strong> {formatCOP(cif.real)} ({formatPct(pctCif)})
              </span>
            </div>
          </div>
        </div>

        {/* Comparativa Cara a Cara (Vs Columns) */}
        <div className={styles.versusGrid}>
          {/* Columna Materiales */}
          <div className={styles.versusCol}>
            <div className={`${styles.versusColHead} ${styles.headMat}`}>
              <h3 className={styles.colTitle}>Costo de Materiales</h3>
              <span className={`${styles.colTag} ${styles.tagMat}`}>Insumos & Telas</span>
            </div>
            <div className={styles.versusStatList}>
              <div className={styles.versusStatRow}>
                <span className={styles.versusStatLabel}>Presupuestado:</span>
                <span className={styles.versusStatValue}>{formatCOP(materiales.presupuestado)}</span>
              </div>
              <div className={styles.versusStatRow}>
                <span className={styles.versusStatLabel}>Real Liquidado:</span>
                <span className={styles.versusStatValue}>{formatCOP(materiales.real)}</span>
              </div>
              <div className={styles.versusStatRow}>
                <span className={styles.versusStatLabel}>Desviación / Variación:</span>
                <span
                  className={styles.versusStatValue}
                  style={{ color: materiales.variacion > 0 ? '#b91c1c' : '#047857' }}
                >
                  {materiales.variacion > 0 ? '+' : ''}{formatCOP(materiales.variacion)} ({formatPct(materiales.variacion_pct)})
                </span>
              </div>
              <div className={styles.versusStatRow}>
                <span className={styles.versusStatLabel}>Costo Unitario por Prenda:</span>
                <span className={styles.versusStatValue}>{formatCOP(materiales.unitario_real)}</span>
              </div>
              <div className={styles.versusStatRow}>
                <span className={styles.versusStatLabel}>Participación en Costo:</span>
                <span className={styles.versusStatValue}>{formatPct(pctMat)}</span>
              </div>
            </div>
          </div>

          {/* Columna Mano de Obra */}
          <div className={styles.versusCol}>
            <div className={`${styles.versusColHead} ${styles.headMo}`}>
              <h3 className={styles.colTitle}>Costo de Mano de Obra</h3>
              <span className={`${styles.colTag} ${styles.tagMo}`}>Corte, Ensamble & Lavandería</span>
            </div>
            <div className={styles.versusStatList}>
              <div className={styles.versusStatRow}>
                <span className={styles.versusStatLabel}>Presupuestado:</span>
                <span className={styles.versusStatValue}>{formatCOP(mano_obra.presupuestado)}</span>
              </div>
              <div className={styles.versusStatRow}>
                <span className={styles.versusStatLabel}>Real Liquidado:</span>
                <span className={styles.versusStatValue}>{formatCOP(mano_obra.real)}</span>
              </div>
              <div className={styles.versusStatRow}>
                <span className={styles.versusStatLabel}>Desviación / Variación:</span>
                <span
                  className={styles.versusStatValue}
                  style={{ color: mano_obra.variacion > 0 ? '#b91c1c' : '#047857' }}
                >
                  {mano_obra.variacion > 0 ? '+' : ''}{formatCOP(mano_obra.variacion)} ({formatPct(mano_obra.variacion_pct)})
                </span>
              </div>
              <div className={styles.versusStatRow}>
                <span className={styles.versusStatLabel}>Costo Unitario por Prenda:</span>
                <span className={styles.versusStatValue}>{formatCOP(mano_obra.unitario_real)}</span>
              </div>
              <div className={styles.versusStatRow}>
                <span className={styles.versusStatLabel}>Participación en Costo:</span>
                <span className={styles.versusStatValue}>{formatPct(pctMo)}</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Fila de Gráfica Donut & Métricas de Eficiencia Operativa */}
      <div className={styles.visualInsightsRow}>
        {/* Donut Chart SVG */}
        <div className={styles.donutCard}>
          <h3 className={styles.toolbarTitleBox} style={{ marginBottom: '1rem', textAlign: 'center' }}>
            Composición del Gasto
          </h3>
          <div className={styles.donutSvgWrap}>
            <svg width="180" height="180" viewBox="0 0 160 160">
              <circle
                cx="80"
                cy="80"
                r={radius}
                fill="transparent"
                stroke="#f1f5f9"
                strokeWidth="20"
              />
              {/* Materiales Segment */}
              <circle
                cx="80"
                cy="80"
                r={radius}
                fill="transparent"
                stroke="#0f766e"
                strokeWidth="20"
                strokeDasharray={`${strokeMat} ${circumference}`}
                strokeDashoffset={offsetMat}
                transform="rotate(-90 80 80)"
              />
              {/* Mano de Obra Segment */}
              <circle
                cx="80"
                cy="80"
                r={radius}
                fill="transparent"
                stroke="#f59e0b"
                strokeWidth="20"
                strokeDasharray={`${strokeMo} ${circumference}`}
                strokeDashoffset={offsetMo}
                transform="rotate(-90 80 80)"
              />
              {/* CIF Segment */}
              {pctCif > 0 && (
                <circle
                  cx="80"
                  cy="80"
                  r={radius}
                  fill="transparent"
                  stroke="#64748b"
                  strokeWidth="20"
                  strokeDasharray={`${strokeCif} ${circumference}`}
                  strokeDashoffset={offsetCif}
                  transform="rotate(-90 80 80)"
                />
              )}
            </svg>
            <div className={styles.donutCenterLabel}>
              <small>Costo Total</small>
              <strong>{formatCOP(totales.real)}</strong>
            </div>
          </div>
          <p className={styles.subDetailText} style={{ marginTop: '0.75rem', textAlign: 'center' }}>
            Base de cálculo sobre {unidades_primera} prendas de 1ra calidad entregadas.
          </p>
        </div>

        {/* Indicadores de Rendimiento de Producción */}
        <div className={styles.indicatorsCard}>
          <h3 className={styles.toolbarTitleBox}>Indicadores de Producción & Trazabilidad</h3>
          <p className={styles.subtitle}>
            Variables operativas que afectaron directamente la liquidación del lote.
          </p>

          <div className={styles.indicatorsGrid}>
            <div className={styles.indicatorBox}>
              <p className={styles.indicatorLabel}>Rendimiento Confección</p>
              <p className={styles.indicatorValue}>{order.rendimiento_confeccion}%</p>
              <p className={styles.indicatorSub}>
                {order.unidades_primera} de {order.unidades_programadas} programadas
              </p>
            </div>

            <div className={styles.indicatorBox}>
              <p className={styles.indicatorLabel}>Segundas / Mermas</p>
              <p className={styles.indicatorValue} style={{ color: order.unidades_segunda > 5 ? '#b91c1c' : '#047857' }}>
                {order.unidades_segunda} und
              </p>
              <p className={styles.indicatorSub}>
                {((order.unidades_segunda / order.unidades_programadas) * 100).toFixed(1)}% del lote
              </p>
            </div>

            <div className={styles.indicatorBox}>
              <p className={styles.indicatorLabel}>Costo Unitario Total</p>
              <p className={styles.indicatorValue}>{formatCOP(totales.costo_unitario_real)}</p>
              <p className={styles.indicatorSub}>
                Presupuestado: {formatCOP(totales.costo_unitario_presupuestado)}
              </p>
            </div>

            <div className={styles.indicatorBox}>
              <p className={styles.indicatorLabel}>Margen Bruto Obtenido</p>
              <p className={styles.indicatorValue} style={{ color: '#047857' }}>
                {formatPct(totales.margen_bruto_pct)}
              </p>
              <p className={styles.indicatorSub}>
                Utilidad: {formatCOP(totales.utilidad_bruta_unitaria)} / prenda
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
