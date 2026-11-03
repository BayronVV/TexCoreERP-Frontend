import { useCallback, useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { apiGet, apiRequest } from '../../api/client'
import { useAuth } from '../../auth/session'
import { useToast } from '../ui/toastContext'
import Modal from '../ui/Modal'
import { fieldErrors, formatDate } from '../Inventory/labels'
import styles from '../Inventory/Inventory.module.css'
import finishedStyles from './Finished.module.css'
import {
  adjustmentBody, adjustmentConfirmation, adjustmentLines, adjustmentProblems, adjustmentSummary, initialCounts, largeLines, signed,
  summaryText, variantLabel, variantMatrix,
} from './finished'

// Detalle de un ajuste registrado (solo lectura: el comprobante es inalterable).
function AdjustmentDetail({ adjustment, onClose }) {
  return (
    <Modal title={`Ajuste ${adjustment.codigo}`} onClose={onClose} wide>
      <dl className={finishedStyles.lotInfo}>
        <div><dt>Referencia</dt><dd>{adjustment.referencia_nombre || '—'}</dd></div>
        <div><dt>Motivo</dt><dd>{adjustment.motivo_nombre}</dd></div>
        <div><dt>Fecha</dt><dd>{formatDate(adjustment.fecha)}</dd></div>
        <div><dt>Lo hizo</dt><dd>{adjustment.realizado_por_nombre || '—'}</dd></div>
        <div><dt>Faltaban</dt><dd>{adjustment.unidades_faltantes}</dd></div>
        <div><dt>Sobraban</dt><dd>{adjustment.unidades_sobrantes}</dd></div>
      </dl>
      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead><tr><th>Talla y color</th><th className={styles.num}>Sistema</th><th className={styles.num}>Contado</th><th className={styles.num}>Diferencia</th></tr></thead>
          <tbody>
            {adjustment.lineas.map((line) => (
              <tr key={line.id}>
                <td>{variantLabel(line)}</td>
                <td className={styles.num}>{line.stock_antes}</td>
                <td className={styles.num}>{line.stock_contado}</td>
                <td className={`${styles.num} ${line.diferencia > 0 ? finishedStyles.up : finishedStyles.down}`}>{signed(line.diferencia)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className={finishedStyles.note}>Observación: {adjustment.observacion}</p>
    </Modal>
  )
}

// Formulario del conteo: la matriz de una referencia con el saldo del sistema precargado; se digita lo que hay en la bodega.
function AdjustmentForm({ references, initialReference, meta, onSaved }) {
  const notify = useToast()
  const [referenceId, setReferenceId] = useState(initialReference)
  const [edits, setEdits] = useState({})
  const [motivo, setMotivo] = useState('')
  const [observacion, setObservacion] = useState('')
  const [token, setToken] = useState(() => crypto.randomUUID())
  const [errors, setErrors] = useState({})
  const [saving, setSaving] = useState(false)

  const reference = references.find((item) => String(item.referencia) === String(referenceId))
  const matrix = useMemo(() => {
    const variants = (reference?.colores ?? []).flatMap((row) => Object.entries(row.tallas).map(([talla, cell]) => ({ id: cell.variante, talla, color: row.color })))
    return variantMatrix(variants)
  }, [reference])
  const saldo = useMemo(() => initialCounts(reference), [reference])
  // El conteo es el saldo del sistema con lo que la persona haya cambiado; al cambiar de referencia o recargar vuelve a empezar.
  const counts = useMemo(() => ({ ...saldo, ...edits }), [saldo, edits])

  const lines = adjustmentLines(reference, counts)
  const summary = adjustmentSummary(lines)
  const problems = adjustmentProblems({ reference, counts, motivo, observacion, meta })
  const threshold = meta?.umbral_unidades ?? 20
  const big = largeLines(lines, threshold)
  const reason = (meta?.motivos ?? []).find((item) => item.codigo === motivo)

  const submit = async (event) => {
    event.preventDefault()
    if (problems.length) return setErrors({ detail: problems[0] })
    if (!window.confirm(adjustmentConfirmation(lines, reason.nombre))) return
    setSaving(true)
    setErrors({})
    try {
      const saved = await apiRequest('/api/terminado/ajustes/', { method: 'POST', body: adjustmentBody({ reference, counts, motivo, observacion, token }) })
      notify(`Ajuste ${saved.codigo} registrado.`)
      setMotivo('')
      setObservacion('')
      setToken(crypto.randomUUID())
      setEdits({})
      onSaved()
    } catch (error) {
      setErrors(fieldErrors(error))
      if (error.status === 409) {
        setEdits({}) // el stock cambió o el ajuste ya existía: se recarga la matriz con los saldos reales
        onSaved()
      }
    } finally {
      setSaving(false)
    }
  }

  const err = (name) => errors[name] && <span className={styles.fieldError}>{errors[name]}</span>

  return (
    <form className={styles.form} onSubmit={submit} noValidate>
      <label className={styles.field}>
        Referencia
        <select value={referenceId} onChange={(event) => { setReferenceId(event.target.value); setEdits({}) }} aria-label="Referencia a ajustar">
          <option value="">Elige la referencia</option>
          {references.map((item) => <option key={item.referencia} value={item.referencia}>{item.codigo} · {item.nombre}</option>)}
        </select>
      </label>

      {reference && (
        <>
          <p className={styles.subhead}>Conteo real por talla y color</p>
          <p className={finishedStyles.note}>Cada celda trae el saldo del sistema. Cambia solo las tallas donde lo contado en la bodega sea distinto.</p>
          <div className={finishedStyles.matrixWrap}>
            <table className={finishedStyles.matrix}>
              <thead>
                <tr><th>Color</th>{matrix.sizes.map((size) => <th key={size}>Talla {size}</th>)}</tr>
              </thead>
              <tbody>
                {matrix.rows.map((row) => (
                  <tr key={row.color}>
                    <th scope="row">{row.color}</th>
                    {matrix.sizes.map((size) => {
                      const variant = row.cells[size]
                      if (!variant) return <td key={size} className={finishedStyles.cellMissing}>—</td>
                      const line = lines.find((item) => item.variante === variant.id)
                      return (
                        <td key={size} className={line ? finishedStyles.cellChanged : ''}>
                          <input
                            className={finishedStyles.cellInput} value={counts[variant.id] ?? ''} inputMode="numeric"
                            onChange={(event) => setEdits((current) => ({ ...current, [variant.id]: event.target.value }))}
                            aria-label={`Conteo talla ${size} ${row.color}`}
                          />
                          <span className={finishedStyles.plan}>
                            sistema {saldo[variant.id]}
                            {line && <strong className={line.diferencia > 0 ? finishedStyles.up : finishedStyles.down}> {signed(line.diferencia)}</strong>}
                          </span>
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {err('lineas')}

          <div className={`${finishedStyles.balance} ${lines.length ? finishedStyles.balanceWarn : finishedStyles.balanceOk}`} role="status">
            <span>{summaryText(summary)}</span>
            <span>{lines.length ? `${lines.length} ${lines.length === 1 ? 'talla cambia' : 'tallas cambian'}` : 'El conteo coincide con el sistema'}</span>
          </div>

          <div className={styles.grid}>
            <label className={styles.field}>
              Motivo
              <select value={motivo} onChange={(event) => setMotivo(event.target.value)} aria-label="Motivo del ajuste">
                <option value="">Elige el motivo</option>
                {(meta?.motivos ?? []).map((item) => <option key={item.codigo} value={item.codigo}>{item.nombre}</option>)}
              </select>
              {err('motivo')}
            </label>
            <label className={styles.field}>
              Observación (obligatoria)
              <textarea value={observacion} onChange={(event) => setObservacion(event.target.value)} maxLength={500} rows={3} aria-label="Observación del ajuste" />
              {err('observacion')}
            </label>
          </div>
          {big.length > 0 && (
            <p className={finishedStyles.note} role="status">
              Más de {threshold} unidades en {big.map(variantLabel).join(', ')}: «Otro» no se acepta y la observación pide al menos {meta?.observacion_minima_umbral ?? 30} caracteres.
            </p>
          )}
        </>
      )}

      {errors.detail && <p className={styles.formError}>{errors.detail}</p>}
      <div className={styles.actions}>
        <button type="submit" className={styles.primaryBtn} disabled={!reference || saving || problems.length > 0} title={problems[0] ?? ''}>
          {saving ? 'Guardando…' : 'Registrar ajuste'}
        </button>
      </div>
    </form>
  )
}

// Producto terminado · Ajuste manual (RF22): corrige descuadres entre el conteo físico y el sistema. Ajustar exige
// `producto_terminado.ajustar` (Secretaria y Administrador); el historial lo ven quienes tienen `producto_terminado.ver`.
export default function AdjustmentPage() {
  const { can } = useAuth()
  const canAdjust = can('producto_terminado.ajustar')
  const [params] = useSearchParams()
  const [references, setReferences] = useState([])
  const [meta, setMeta] = useState(null)
  const [history, setHistory] = useState(null)
  const [search, setSearch] = useState('')
  const [reason, setReason] = useState('')
  const [loadError, setLoadError] = useState('')
  const [viewing, setViewing] = useState(null)

  const loadStock = useCallback(() => {
    apiGet('/api/terminado/existencias/').then(setReferences).catch((error) => setLoadError(error.message))
  }, [])

  const loadHistory = useCallback(() => {
    const query = new URLSearchParams({ limit: '200' })
    if (search.trim()) query.set('q', search.trim())
    if (reason) query.set('motivo', reason)
    apiGet(`/api/terminado/ajustes/?${query}`).then((data) => (setHistory(data), setLoadError(''))).catch((error) => setLoadError(error.message))
  }, [search, reason])

  useEffect(() => {
    apiGet('/api/terminado/metadatos/').then(setMeta).catch((error) => setLoadError(error.message))
    if (canAdjust) loadStock()
  }, [canAdjust, loadStock])

  useEffect(() => {
    const timer = setTimeout(loadHistory, 250)
    return () => clearTimeout(timer)
  }, [loadHistory])

  return (
    <div className={styles.page}>
      <header className={styles.pageHeader}>
        <p className={styles.eyebrow}>Producto terminado</p>
        <h1>Ajuste manual</h1>
        <p className={styles.subtitle}>
          Corrige los descuadres entre lo que hay en la bodega y lo que dice el sistema. Se digita el conteo real, el sistema calcula la
          diferencia y deja un comprobante que no se puede editar ni borrar: un error se corrige con otro ajuste.
        </p>
      </header>

      {loadError && <p className={styles.formError}>{loadError}</p>}

      {canAdjust && (
        <section className={styles.card}>
          <h2 className={styles.cardTitle}>Nuevo ajuste</h2>
          <AdjustmentForm
            key={params.get('referencia') ?? ''} references={references} initialReference={params.get('referencia') ?? ''} meta={meta}
            onSaved={() => { loadStock(); loadHistory() }}
          />
        </section>
      )}

      <section className={styles.card}>
        <h2 className={styles.cardTitle}>Ajustes registrados</h2>
        <div className={styles.filters}>
          <input type="search" placeholder="Buscar por código u observación" value={search} onChange={(event) => setSearch(event.target.value)} aria-label="Buscar ajustes" />
          <select value={reason} onChange={(event) => setReason(event.target.value)} aria-label="Filtrar por motivo">
            <option value="">Todos los motivos</option>
            {(meta?.motivos ?? []).map((item) => <option key={item.codigo} value={item.codigo}>{item.nombre}</option>)}
          </select>
        </div>
        {history && history.length === 0 && <p className={styles.empty}>{search || reason ? 'Ningún ajuste coincide con el filtro.' : 'Todavía no hay ajustes registrados.'}</p>}
        {history && history.length > 0 && (
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr><th>Ajuste</th><th>Fecha</th><th>Referencia</th><th>Motivo</th><th className={styles.num}>Faltaban</th><th className={styles.num}>Sobraban</th><th>Lo hizo</th><th /></tr>
              </thead>
              <tbody>
                {history.map((item) => (
                  <tr key={item.id}>
                    <td><strong>{item.codigo}</strong></td>
                    <td>{formatDate(item.fecha)}</td>
                    <td>{item.referencia_nombre || '—'}</td>
                    <td>{item.motivo_nombre}</td>
                    <td className={styles.num}>{item.unidades_faltantes}</td>
                    <td className={styles.num}>{item.unidades_sobrantes}</td>
                    <td>{item.realizado_por_nombre || '—'}</td>
                    <td><button type="button" className={styles.linkBtn} onClick={() => setViewing(item)}>Ver</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {viewing && <AdjustmentDetail adjustment={viewing} onClose={() => setViewing(null)} />}
    </div>
  )
}
