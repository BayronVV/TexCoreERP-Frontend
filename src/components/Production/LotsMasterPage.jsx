import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import styles from './LotsMasterPage.module.css'

const parsePositiveInteger = (value) => {
  if (value === '' || value === undefined || value === null) return null

  const normalized = String(value).trim()
  if (!normalized) return null

  const number = Number(normalized)
  if (!Number.isFinite(number) || !Number.isInteger(number)) return null

  return number
}

const buildLotsByCount = (total, lotCount) => {
  const base = Math.floor(total / lotCount)
  const remainder = total % lotCount

  return {
    lotCount,
    lots: Array.from({ length: lotCount }, (_, index) => base + (index < remainder ? 1 : 0)),
    exact: remainder === 0,
    remainder,
    average: total / lotCount,
  }
}

const buildLotsByUnitSize = (total, unitsPerLot) => {
  const fullLots = Math.floor(total / unitsPerLot)
  const remainder = total % unitsPerLot
  const lots = Array.from({ length: fullLots }, () => unitsPerLot)

  if (remainder > 0) {
    lots.push(remainder)
  }

  return {
    lotCount: lots.length,
    lots: lots.length > 0 ? lots : [0],
    exact: remainder === 0,
    remainder,
    average: total / Math.max(1, lots.length),
  }
}

export default function LotsMasterPage() {
  const navigate = useNavigate()
  const [totalUnits, setTotalUnits] = useState('')
  const [mode, setMode] = useState('count')
  const [lotCount, setLotCount] = useState('')
  const [unitsPerLot, setUnitsPerLot] = useState('')

  const totalValue = parsePositiveInteger(totalUnits)
  const lotCountValue = parsePositiveInteger(lotCount)
  const unitsPerLotValue = parsePositiveInteger(unitsPerLot)

  const totalError = !totalUnits ? 'Ingresa la cantidad total de unidades.' : totalValue === null || totalValue <= 0 ? 'La cantidad total debe ser un número entero mayor que cero.' : ''

  const countError =
    mode === 'count'
      ? !lotCount
        ? 'Ingresa la cantidad de lotes.'
        : lotCountValue === null || lotCountValue <= 0
          ? 'La cantidad de lotes debe ser un número entero mayor que cero.'
          : lotCountValue > (totalValue ?? 0)
            ? 'El número de lotes no puede superar la cantidad total de unidades.'
            : ''
      : ''

  const unitsError =
    mode === 'size'
      ? !unitsPerLot
        ? 'Ingresa la cantidad de unidades por lote.'
        : unitsPerLotValue === null || unitsPerLotValue <= 0
          ? 'Las unidades por lote deben ser un número entero mayor que cero.'
          : ''
      : ''

  const distribution = useMemo(() => {
    if (totalValue === null || totalValue <= 0) return null

    if (mode === 'count') {
      if (lotCountValue === null || lotCountValue <= 0 || lotCountValue > totalValue) return null
      return buildLotsByCount(totalValue, lotCountValue)
    }

    if (unitsPerLotValue === null || unitsPerLotValue <= 0) return null
    return buildLotsByUnitSize(totalValue, unitsPerLotValue)
  }, [lotCountValue, mode, totalValue, unitsPerLotValue])

  const showSummary = !totalError && !countError && !unitsError && distribution

  const exactMessage = showSummary
    ? distribution.exact
      ? 'La distribución es exacta. No hay sobrantes.'
      : `La cantidad total no se divide exactamente. Se ajustará con ${distribution.remainder} unidad${distribution.remainder === 1 ? '' : 'es'} sobrante${distribution.remainder === 1 ? '' : 's'} para completar la producción.`
    : ''

  const modeDescription =
    mode === 'count'
      ? 'Se define la cantidad de lotes y el sistema reparte la producción de forma equilibrada.'
      : 'Se define la cantidad por lote y el sistema crea el número de lotes necesario.'

  return (
    <div className={styles.page}>
      <header className={styles.pageHeader}>
        <p className={styles.eyebrow}>Producción</p>
        <h1>Generación de órdenes y lotes</h1>
        <p className={styles.subtitle}>
          Define la cantidad total y cómo se distribuirá la producción entre los lotes antes de continuar.
        </p>
      </header>

      <div className={styles.topSummary}>
        <div>
          <span className={styles.stepLabel}>Paso 1</span>
          <strong>Configurar producción</strong>
        </div>
        <p>{modeDescription}</p>
      </div>

      <section className={styles.card}>
        <div className={styles.grid}>
          <div className={styles.field}>
            <label htmlFor="total-units">Cantidad total de unidades</label>
            <input
              id="total-units"
              type="number"
              min="1"
              step="1"
              inputMode="numeric"
              value={totalUnits}
              onChange={(event) => setTotalUnits(event.target.value)}
              placeholder="Ej. 120"
              aria-invalid={Boolean(totalError)}
            />
            {totalError && <span className={styles.fieldError}>{totalError}</span>}
          </div>

          <div className={styles.fieldFull}>
            <span className={styles.label}>Forma de distribución</span>
            <div className={styles.modeToggle} role="tablist" aria-label="Método de división de lotes">
              <button
                type="button"
                className={`${styles.modeButton} ${mode === 'count' ? styles.modeButtonActive : ''}`}
                onClick={() => setMode('count')}
                aria-pressed={mode === 'count'}
              >
                Cantidad de lotes
              </button>
              <button
                type="button"
                className={`${styles.modeButton} ${mode === 'size' ? styles.modeButtonActive : ''}`}
                onClick={() => setMode('size')}
                aria-pressed={mode === 'size'}
              >
                Unidades por lote
              </button>
            </div>
          </div>

          {mode === 'count' && (
            <div className={styles.field}>
              <label htmlFor="lot-count">Cantidad de lotes</label>
              <input
                id="lot-count"
                type="number"
                min="1"
                step="1"
                inputMode="numeric"
                value={lotCount}
                onChange={(event) => setLotCount(event.target.value)}
                placeholder="Ej. 4"
                aria-invalid={Boolean(countError)}
              />
              {countError && <span className={styles.fieldError}>{countError}</span>}
            </div>
          )}

          {mode === 'size' && (
            <div className={styles.field}>
              <label htmlFor="units-per-lot">Unidades por lote</label>
              <input
                id="units-per-lot"
                type="number"
                min="1"
                step="1"
                inputMode="numeric"
                value={unitsPerLot}
                onChange={(event) => setUnitsPerLot(event.target.value)}
                placeholder="Ej. 30"
                aria-invalid={Boolean(unitsError)}
              />
              {unitsError && <span className={styles.fieldError}>{unitsError}</span>}
            </div>
          )}
        </div>

        {showSummary && (
          <div className={styles.summaryPanel}>
            <div className={styles.summaryHeader}>
              <h2>Resumen de la distribución</h2>
              <span className={`${styles.badge} ${distribution.exact ? styles.badgeOk : styles.badgeWarn}`}>
                {distribution.exact ? 'Exacta' : 'Ajustada'}
              </span>
            </div>

            <p className={`${styles.summaryMessage} ${distribution.exact ? styles.successText : styles.warningText}`}>
              {exactMessage}
            </p>

            <div className={styles.summaryMeta}>
              <div>
                <span>Total</span>
                <strong>{totalValue.toLocaleString('es-CO')} unidades</strong>
              </div>
              <div>
                <span>Lotes</span>
                <strong>{distribution.lotCount}</strong>
              </div>
              <div>
                <span>Promedio</span>
                <strong>{distribution.average.toFixed(2).replace(/\.00$/, '')} u/lote</strong>
              </div>
            </div>

            <div className={styles.lotLegend} aria-label="Leyenda de la distribución">
              {distribution.exact ? 'La producción queda equilibrada entre lotes.' : 'Hay una diferencia de unidades que debe revisarse antes de continuar.'}
            </div>

            <div className={styles.lotGrid}>
              {distribution.lots.map((lotUnits, index) => (
                <div key={`${lotUnits}-${index}`} className={styles.lotCard}>
                  <span className={styles.lotNumber}>Lote {index + 1}</span>
                  <strong>{lotUnits}</strong>
                  <small>unidades</small>
                </div>
              ))}
            </div>
          </div>
        )}
      </section>

      <div className={styles.actions}>
        <button type="button" className={styles.secondaryBtn} onClick={() => navigate('/dashboard')}>
          Cancelar
        </button>
        <button type="button" className={styles.primaryBtn} disabled={!showSummary}>
          Continuar
        </button>
      </div>
    </div>
  )
}
