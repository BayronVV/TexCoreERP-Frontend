import { useMemo, useRef, useState } from 'react'
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

const parseNonNegativeInteger = (value) => {
  if (value === '' || value === undefined || value === null) return null

  const normalized = String(value).trim()
  if (!normalized) return null
  const number = Number(normalized)
  if (!Number.isFinite(number) || !Number.isInteger(number) || number <= 0) return null

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
  const [sizeConfigurations, setSizeConfigurations] = useState({})
  const nextSizeId = useRef(0)
  const [continueNotice, setContinueNotice] = useState(false)

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

  const lotBreakdown = useMemo(() => {
    if (!distribution) return []

    return distribution.lots.map((expectedUnits, lotIndex) => {
      const entries = sizeConfigurations[lotIndex] ?? []
      const labelCounts = new Map()

      entries.forEach((entry) => {
        const normalizedLabel = entry.label.trim().toLocaleLowerCase()
        if (normalizedLabel) labelCounts.set(normalizedLabel, (labelCounts.get(normalizedLabel) ?? 0) + 1)
      })

      const rows = entries.map((entry) => {
        const label = entry.label.trim()
        const normalizedLabel = label.toLocaleLowerCase()
        const quantity = parseNonNegativeInteger(entry.quantity)

        return {
          ...entry,
          labelError: !label
            ? 'Escribe la talla.'
            : labelCounts.get(normalizedLabel) > 1
              ? 'Esta talla ya está agregada en el lote.'
              : '',
          quantityValue: quantity,
          quantityError: entry.quantity === ''
            ? 'Ingresa las unidades de esta talla.'
            : quantity === null
              ? 'Usa un entero mayor que cero.'
              : '',
        }
      })

      const configuredUnits = rows.reduce((sum, row) => sum + (row.quantityValue ?? 0), 0)
      const fieldsValid = rows.length > 0 && rows.every((row) => !row.labelError && !row.quantityError)

      return {
        lotIndex,
        expectedUnits,
        rows,
        configuredUnits,
        difference: expectedUnits - configuredUnits,
        valid: fieldsValid && configuredUnits === expectedUnits,
      }
    })
  }, [distribution, sizeConfigurations])

  const configuredUnits = lotBreakdown.reduce((sum, lot) => sum + lot.configuredUnits, 0)
  const configuredBySize = new Map()
  lotBreakdown.forEach((lot) => {
    lot.rows.forEach((row) => {
      if (!row.label || row.quantityValue === null) return
      const key = row.label.toLocaleLowerCase()
      const existing = configuredBySize.get(key)
      if (existing) existing.quantity += row.quantityValue
      else configuredBySize.set(key, { label: row.label, quantity: row.quantityValue })
    })
  })
  const sizeTotals = [...configuredBySize.values()].sort((first, second) => first.label.localeCompare(second.label))
  const canContinue = Boolean(showSummary) && lotBreakdown.length > 0 && lotBreakdown.every((lot) => lot.valid)

  const updateSizeRow = (lotIndex, rowId, field, value) => {
    setContinueNotice(false)
    setSizeConfigurations((current) => ({
      ...current,
      [lotIndex]: (current[lotIndex] ?? []).map((row) =>
        row.id === rowId ? { ...row, [field]: value } : row,
      ),
    }))
  }

  const addSizeRow = (lotIndex) => {
    const rowId = nextSizeId.current
    nextSizeId.current += 1
    setContinueNotice(false)
    setSizeConfigurations((current) => ({
      ...current,
      [lotIndex]: [...(current[lotIndex] ?? []), { id: rowId, label: '', quantity: '' }],
    }))
  }

  const removeSizeRow = (lotIndex, rowId) => {
    setContinueNotice(false)
    setSizeConfigurations((current) => ({
      ...current,
      [lotIndex]: (current[lotIndex] ?? []).filter((row) => row.id !== rowId),
    }))
  }

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
              onChange={(event) => (setTotalUnits(event.target.value), setContinueNotice(false))}
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
                onClick={() => (setMode('count'), setContinueNotice(false))}
                aria-pressed={mode === 'count'}
              >
                Cantidad de lotes
              </button>
              <button
                type="button"
                className={`${styles.modeButton} ${mode === 'size' ? styles.modeButtonActive : ''}`}
                onClick={() => (setMode('size'), setContinueNotice(false))}
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
                onChange={(event) => (setLotCount(event.target.value), setContinueNotice(false))}
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
                onChange={(event) => (setUnitsPerLot(event.target.value), setContinueNotice(false))}
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

            <section className={styles.sizesSection} aria-labelledby="sizes-title">
              <div className={styles.sizesHeader}>
                <div>
                  <h2 id="sizes-title">Tallas por lote</h2>
                  <p>Escribe las tallas definidas para esta producción y asigna las unidades de cada una.</p>
                </div>
              </div>

              <div className={styles.lotSizeList}>
                {lotBreakdown.map((lot) => {
                  const hasFieldErrors = lot.rows.some((row) => row.labelError || row.quantityError)
                  const lotMessage = lot.rows.length === 0
                    ? 'Agrega al menos una talla y asigna sus unidades.'
                    : hasFieldErrors
                      ? 'Corrige los campos marcados para validar este lote.'
                      : lot.difference > 0
                        ? `Faltan ${lot.difference} unidad${lot.difference === 1 ? '' : 'es'} para completar este lote.`
                        : lot.difference < 0
                          ? `Hay ${Math.abs(lot.difference)} unidad${Math.abs(lot.difference) === 1 ? '' : 'es'} de más en este lote.`
                          : 'La suma de tallas coincide con las unidades previstas.'

                  return (
                    <article key={lot.lotIndex} className={styles.lotSizeCard}>
                      <header className={styles.lotSizeHeader}>
                        <div>
                          <h3>Lote {lot.lotIndex + 1}</h3>
                          <span>{lot.expectedUnits.toLocaleString('es-CO')} unidades previstas</span>
                        </div>
                        <strong className={lot.valid ? styles.lotTotalOk : styles.lotTotalWarn}>
                          {lot.configuredUnits.toLocaleString('es-CO')} / {lot.expectedUnits.toLocaleString('es-CO')} u
                        </strong>
                      </header>

                      {lot.rows.length > 0 && (
                        <div className={styles.sizeRows}>
                          {lot.rows.map((row) => (
                            <div key={row.id} className={styles.sizeRow}>
                              <label className={styles.sizeField}>
                                <span>Talla</span>
                                <input
                                  type="text"
                                  value={row.label}
                                  maxLength={40}
                                  placeholder="Según ficha técnica"
                                  aria-invalid={Boolean(row.labelError)}
                                  onChange={(event) => updateSizeRow(lot.lotIndex, row.id, 'label', event.target.value)}
                                />
                                {row.labelError && <small className={styles.fieldError}>{row.labelError}</small>}
                              </label>
                              <label className={styles.sizeField}>
                                <span>Unidades</span>
                                <input
                                  type="number"
                                  min="1"
                                  step="1"
                                  inputMode="numeric"
                                  value={row.quantity}
                                  aria-invalid={Boolean(row.quantityError)}
                                  onChange={(event) => updateSizeRow(lot.lotIndex, row.id, 'quantity', event.target.value)}
                                />
                                {row.quantityError && <small className={styles.fieldError}>{row.quantityError}</small>}
                              </label>
                              <button
                                type="button"
                                className={styles.removeSizeButton}
                                onClick={() => removeSizeRow(lot.lotIndex, row.id)}
                                aria-label={`Quitar talla ${row.label || 'sin nombre'} del lote ${lot.lotIndex + 1}`}
                              >
                                Quitar
                              </button>
                            </div>
                          ))}
                        </div>
                      )}

                      <div className={styles.lotSizeFooter}>
                        <button type="button" className={styles.addSizeButton} onClick={() => addSizeRow(lot.lotIndex)}>
                          + Agregar talla
                        </button>
                        <p className={lot.valid ? styles.lotMessageOk : styles.lotMessageWarn} role="status">
                          {lotMessage}
                        </p>
                      </div>
                    </article>
                  )
                })}
              </div>

              <div className={styles.sizeTotalsPanel}>
                <div className={styles.sizeTotalsHeader}>
                  <div>
                    <h3>Resumen de unidades por talla</h3>
                    <p>{configuredUnits.toLocaleString('es-CO')} de {totalValue.toLocaleString('es-CO')} unidades configuradas</p>
                  </div>
                  <span className={canContinue ? styles.badgeOk : styles.badgeWarn}>
                    {canContinue ? 'Lotes completos' : 'Configuración pendiente'}
                  </span>
                </div>
                {sizeTotals.length > 0 ? (
                  <div className={styles.sizeTotalsList}>
                    {sizeTotals.map((size) => (
                      <div key={size.label.toLocaleLowerCase()}>
                        <span>{size.label}</span>
                        <strong>{size.quantity.toLocaleString('es-CO')} u</strong>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className={styles.sizeTotalsEmpty}>Aún no hay unidades asignadas a tallas.</p>
                )}
              </div>
            </section>
          </div>
        )}
      </section>

      <div className={styles.actions}>
        <button type="button" className={styles.secondaryBtn} onClick={() => navigate('/dashboard')}>
          Cancelar
        </button>
        <button
          type="button"
          className={styles.primaryBtn}
          disabled={!canContinue}
          onClick={() => setContinueNotice(true)}
        >
          Continuar
        </button>
      </div>
      {continueNotice && canContinue && (
        <p className={styles.continueNotice} role="status">
          Configuración validada localmente. La creación de la orden no está conectada en esta subtarea.
        </p>
      )}
    </div>
  )
}
