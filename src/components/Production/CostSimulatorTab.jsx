import React, { useState } from 'react'
import styles from './Production.module.css'

const formatCOP = (val) => {
  const num = Number(val) || 0
  return `$ ${num.toLocaleString('es-CO', { maximumFractionDigits: 0 })}`
}

const formatPct = (val) => {
  const num = Number(val) || 0
  return `${num.toLocaleString('es-CO', { minimumFractionDigits: 1, maximumFractionDigits: 2 })}%`
}

export default function CostSimulatorTab({ order }) {
  const basePrice = order.precio_venta_unitario || 68000
  const baseMat = order.resumen.materiales.real
  const baseMo = order.resumen.mano_obra.real
  const baseCif = order.resumen.cif.real
  const prendas = order.unidades_primera || 492

  // Sliders
  const [salePrice, setSalePrice] = useState(basePrice)
  const [matDelta, setMatDelta] = useState(0) // -20% to +30%
  const [moDelta, setMoDelta] = useState(0) // -20% to +30%

  // Cálculos dinámicos
  const simMat = baseMat * (1 + matDelta / 100)
  const simMo = baseMo * (1 + moDelta / 100)
  const simTotalCost = simMat + simMo + baseCif
  const simUnitCost = simTotalCost / prendas

  const simRevenue = salePrice * prendas
  const simGrossProfit = simRevenue - simTotalCost
  const simGrossMarginPct = (simGrossProfit / simRevenue) * 100

  const handleReset = () => {
    setSalePrice(basePrice)
    setMatDelta(0)
    setMoDelta(0)
  }

  return (
    <div className={styles.simulatorCard}>
      <div className={styles.tableToolbar}>
        <div className={styles.toolbarTitleBox}>
          <h2>Simulador de Escenarios de Costos & Rentabilidad (What-If)</h2>
          <p>
            Evalúa el impacto de fluctuaciones en el precio del denim, eficiencias en mano de obra o cambios en el precio de venta.
          </p>
        </div>

        <button type="button" className={`${styles.btn} ${styles.btnSecondary}`} onClick={handleReset}>
          Restablecer Valores Base
        </button>
      </div>

      <div className={styles.simulatorGrid}>
        {/* Controles del Simulador */}
        <div className={styles.simulatorControls}>
          <div className={styles.sliderGroup}>
            <div className={styles.sliderHead}>
              <label htmlFor="priceRange">Precio de Venta Objetivo (COP):</label>
              <span>{formatCOP(salePrice)}</span>
            </div>
            <input
              id="priceRange"
              type="range"
              min="40000"
              max="120000"
              step="1000"
              value={salePrice}
              onChange={(e) => setSalePrice(Number(e.target.value))}
              className={styles.rangeInput}
            />
            <span className={styles.subDetailText}>
              Precio base en catálogo: {formatCOP(basePrice)}
            </span>
          </div>

          <div className={styles.sliderGroup}>
            <div className={styles.sliderHead}>
              <label htmlFor="matDeltaRange">Variación en Costo de Materiales (%):</label>
              <span style={{ color: matDelta > 0 ? '#b91c1c' : matDelta < 0 ? '#047857' : '#0f766e' }}>
                {matDelta > 0 ? '+' : ''}{matDelta}%
              </span>
            </div>
            <input
              id="matDeltaRange"
              type="range"
              min="-20"
              max="30"
              step="1"
              value={matDelta}
              onChange={(e) => setMatDelta(Number(e.target.value))}
              className={styles.rangeInput}
            />
            <span className={styles.subDetailText}>
              Simula alzas en algodón/denim o descuentos por volumen de compra.
            </span>
          </div>

          <div className={styles.sliderGroup}>
            <div className={styles.sliderHead}>
              <label htmlFor="moDeltaRange">Variación en Mano de Obra (%):</label>
              <span style={{ color: moDelta > 0 ? '#b91c1c' : moDelta < 0 ? '#047857' : '#0f766e' }}>
                {moDelta > 0 ? '+' : ''}{moDelta}%
              </span>
            </div>
            <input
              id="moDeltaRange"
              type="range"
              min="-20"
              max="30"
              step="1"
              value={moDelta}
              onChange={(e) => setMoDelta(Number(e.target.value))}
              className={styles.rangeInput}
            />
            <span className={styles.subDetailText}>
              Simula reducción de tiempos SAM o incremento por horas extras.
            </span>
          </div>
        </div>

        {/* Resultados del Escenario */}
        <div className={styles.simulatorResults}>
          <div>
            <h3 className={styles.toolbarTitleBox} style={{ color: '#064e3b' }}>
              Proyección de Margen con este Escenario
            </h3>
            <p className={styles.subtitle} style={{ color: '#047857' }}>
              Basado en las {prendas} prendas de primera calidad terminadas.
            </p>

            <div className={styles.simStatGrid}>
              <div className={styles.simBox}>
                <p className={styles.simBoxLabel}>Nuevo Costo x Prenda</p>
                <p className={styles.simBoxValue}>{formatCOP(simUnitCost)}</p>
                <span className={styles.subDetailText} style={{ color: '#047857' }}>
                  Base: {formatCOP(order.resumen.totales.costo_unitario_real)}
                </span>
              </div>

              <div className={styles.simBox}>
                <p className={styles.simBoxLabel}>Margen Bruto Proyectado</p>
                <p
                  className={styles.simBoxValue}
                  style={{ color: simGrossMarginPct >= 40 ? '#047857' : '#b45309' }}
                >
                  {formatPct(simGrossMarginPct)}
                </p>
                <span className={styles.subDetailText} style={{ color: '#047857' }}>
                  Base: {formatPct(order.resumen.totales.margen_bruto_pct)}
                </span>
              </div>

              <div className={styles.simBox}>
                <p className={styles.simBoxLabel}>Costo Total Orden</p>
                <p className={styles.simBoxValue}>{formatCOP(simTotalCost)}</p>
                <span className={styles.subDetailText} style={{ color: '#047857' }}>
                  Mat: {formatCOP(simMat)} • MO: {formatCOP(simMo)}
                </span>
              </div>

              <div className={styles.simBox}>
                <p className={styles.simBoxLabel}>Utilidad Bruta Total</p>
                <p className={styles.simBoxValue}>{formatCOP(simGrossProfit)}</p>
                <span className={styles.subDetailText} style={{ color: '#047857' }}>
                  Ingreso: {formatCOP(simRevenue)}
                </span>
              </div>
            </div>
          </div>

          <div style={{ marginTop: '1.25rem', paddingTop: '1rem', borderTop: '1px dashed #a7f3d0' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.86rem', fontWeight: 600, color: '#064e3b' }}>
              <span>Salud Financiera del Lote:</span>
              <span>
                {simGrossMarginPct >= 45 ? 'Rentabilidad Excelente (Óptima)' : simGrossMarginPct >= 35 ? 'Rentabilidad Normal' : 'Margen Bajo / Riesgo'}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
