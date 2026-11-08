import { useCallback, useEffect, useMemo, useState } from 'react'
import { apiGet, apiRequest } from '../../api/client'
import { useAuth } from '../../auth/session'
import { useToast } from '../ui/toastContext'
import { fieldErrors, formatDate, todayISO } from '../Inventory/labels'
import styles from '../Inventory/Inventory.module.css'
import shipStyles from './Shipping.module.css'
import { dispatchable, dispatchBody, dispatchConfirmation, dispatchProblems, money, toggleId } from './shipping'

const formatMoment = (value) => (value ? new Date(value).toLocaleString('es-CO', { dateStyle: 'medium', timeStyle: 'short' }) : '—')

// Descarga el PDF de una relación con la sesión del usuario («RD-0001.pdf»).
async function downloadDispatchPdf(relation) {
  const blob = await apiRequest(`/api/envios/relaciones/${relation.id}/pdf/`, { blob: true })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `${relation.codigo}.pdf`
  document.body.appendChild(link)
  link.click()
  link.remove()
  setTimeout(() => URL.revokeObjectURL(url), 60000)
}

// Envíos · Relaciones de despacho: se elige la transportadora, se marcan las guías por despachar que se le entregan y se crea la
// relación (RD-0001…): las guías pasan a «En tránsito» y queda un PDF para firmar. Abajo, el historial.
export default function DispatchPage() {
  const { can } = useAuth()
  const notify = useToast()
  const canManage = can('envios.gestionar')
  const [meta, setMeta] = useState(null)
  const [relations, setRelations] = useState(null)
  const [guides, setGuides] = useState([])
  const [carrier, setCarrier] = useState('')
  const [selected, setSelected] = useState([])
  const [date, setDate] = useState(todayISO())
  const [responsible, setResponsible] = useState('')
  const [notes, setNotes] = useState('')
  const [token, setToken] = useState(() => crypto.randomUUID())
  const [error, setError] = useState('')
  const [loadError, setLoadError] = useState('')
  const [saving, setSaving] = useState(false)
  const [created, setCreated] = useState(null)

  const loadRelations = useCallback(() => {
    apiGet('/api/envios/relaciones/').then(setRelations).catch((failure) => setLoadError(failure.message))
  }, [])
  const loadGuides = useCallback(() => {
    if (!canManage) return
    apiGet('/api/envios/guias/?estado=POR_DESPACHAR&limit=200').then(setGuides).catch((failure) => setLoadError(failure.message))
  }, [canManage])

  useEffect(() => {
    apiGet('/api/envios/metadatos/').then(setMeta).catch((failure) => setLoadError(failure.message))
    loadRelations()
    loadGuides()
  }, [loadRelations, loadGuides])

  const available = useMemo(() => dispatchable(guides, carrier), [guides, carrier])
  const chosen = available.filter((guide) => selected.includes(guide.id))
  const problems = dispatchProblems({ carrier, selected: chosen, responsible })
  const carrierName = (meta?.transportadoras ?? []).find((item) => item.codigo === carrier)?.nombre ?? carrier
  const allChecked = available.length > 0 && chosen.length === available.length

  const changeCarrier = (value) => {
    setCarrier(value)
    setSelected([])
    setError('')
  }

  const submit = async (event) => {
    event.preventDefault()
    if (problems.length) return setError(problems[0])
    if (!window.confirm(dispatchConfirmation(carrierName, chosen))) return
    setSaving(true)
    setError('')
    try {
      const saved = await apiRequest('/api/envios/relaciones/', { method: 'POST', body: dispatchBody({ carrier, guideIds: chosen.map((guide) => guide.id), token, date, responsible, notes }) })
      notify(`Relación ${saved.codigo} creada. Las guías pasaron a «En tránsito».`)
      setCreated(saved)
      setSelected([])
      setNotes('')
      setToken(crypto.randomUUID())
      loadGuides()
      loadRelations()
    } catch (failure) {
      if (failure.status === 409) {
        // El mismo envío ya se había procesado (doble clic o reintento): se muestra el código que quedó.
        const code = failure.body?.codigo
        setError(`${fieldErrors(failure).detail ?? failure.message}${code ? ` Relación ya creada: ${code}.` : ''}`)
        setSelected([])
        setToken(crypto.randomUUID())
        loadGuides()
        loadRelations()
      } else {
        const errors = fieldErrors(failure)
        setError(errors.guias ?? errors.responsable ?? errors.transportadora ?? errors.detail ?? failure.message)
        if (failure.status === 400) loadGuides()
      }
    } finally {
      setSaving(false)
    }
  }

  const pdf = async (relation) => {
    try {
      await downloadDispatchPdf(relation)
    } catch (failure) {
      setLoadError(failure.message)
    }
  }

  return (
    <div className={styles.page}>
      <header className={styles.pageHeader}>
        <p className={styles.eyebrow}>Envíos</p>
        <h1>Relaciones de despacho</h1>
        <p className={styles.subtitle}>La relación es la lista de paquetes que se entregan juntos a una transportadora. Al crearla, las guías pasan a «En tránsito» y se genera un PDF para firmar.</p>
      </header>

      {loadError && <p className={styles.formError}>{loadError}</p>}

      {created && (
        <section className={styles.card}>
          <h2 className={styles.cardTitle}>Relación {created.codigo} creada</h2>
          <p>{created.total_guias ?? (created.guias ?? []).length} guía(s) despachadas con {created.transportadora_nombre ?? carrierName}.</p>
          <div className={styles.actions}>
            <button type="button" className={styles.primaryBtn} onClick={() => pdf(created)}>Descargar PDF</button>
            <button type="button" className={styles.secondaryBtn} onClick={() => setCreated(null)}>Cerrar</button>
          </div>
        </section>
      )}

      {canManage && (
        <form onSubmit={submit} noValidate>
          <section className={styles.card}>
            <h2 className={styles.cardTitle}>1. Transportadora y guías</h2>
            <label className={styles.field}>
              Transportadora
              <select value={carrier} onChange={(event) => changeCarrier(event.target.value)} aria-label="Transportadora de la relación">
                <option value="">Elige la transportadora</option>
                {(meta?.transportadoras ?? []).map((item) => <option key={item.codigo} value={item.codigo}>{item.nombre}</option>)}
              </select>
            </label>
            {carrier && available.length === 0 && <p className={styles.empty}>No hay guías por despachar con {carrierName}.</p>}
            {available.length > 0 && (
              <>
                <label className={shipStyles.checkAll}>
                  <input type="checkbox" checked={allChecked} onChange={() => setSelected(allChecked ? [] : available.map((guide) => guide.id))} />
                  Seleccionar todas ({available.length})
                </label>
                <div className={styles.tableWrap}>
                  <table className={styles.table}>
                    <thead><tr><th className={shipStyles.checkCell} /><th>Factura</th><th>Cliente</th><th>Guía</th><th className={styles.num}>Total</th></tr></thead>
                    <tbody>
                      {available.map((guide) => (
                        <tr key={guide.id}>
                          <td className={shipStyles.checkCell}>
                            <input type="checkbox" checked={selected.includes(guide.id)} onChange={() => setSelected((current) => toggleId(current, guide.id))} aria-label={`Incluir la guía de ${guide.factura_numero}`} />
                          </td>
                          <td><strong>{guide.factura_numero}</strong></td>
                          <td>{guide.cliente_nombre}<div className={styles.muted}>{guide.cliente_ciudad}</div></td>
                          <td>{guide.numero_guia}{guide.aviso_formato && <div className={styles.muted}>⚠ {guide.aviso_formato}</div>}</td>
                          <td className={styles.num}>{money(guide.factura_total)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </section>

          <section className={styles.card}>
            <h2 className={styles.cardTitle}>2. Quién entrega</h2>
            <div className={styles.grid}>
              <label className={styles.field}>
                Responsable
                <input value={responsible} onChange={(event) => setResponsible(event.target.value)} maxLength={120} placeholder="Quien entrega los paquetes" />
              </label>
              <label className={styles.field}>
                Fecha
                <input type="date" value={date} onChange={(event) => setDate(event.target.value)} />
              </label>
              <label className={`${styles.field} ${styles.full}`}>
                Observaciones (opcional)
                <textarea value={notes} onChange={(event) => setNotes(event.target.value)} rows={2} maxLength={500} />
              </label>
            </div>
            {error && <p className={styles.formError} role="alert">{error}</p>}
            <div className={styles.actions}>
              <button type="submit" className={styles.primaryBtn} disabled={saving || problems.length > 0} title={problems[0] ?? ''}>
                {saving ? 'Creando…' : `Crear relación y despachar (${chosen.length})`}
              </button>
            </div>
          </section>
        </form>
      )}

      <section className={styles.card}>
        <h2 className={styles.cardTitle}>Historial de relaciones</h2>
        {relations && relations.length === 0 && <p className={styles.empty}>Todavía no hay relaciones de despacho.</p>}
        {relations && relations.length > 0 && (
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead><tr><th>Código</th><th>Fecha</th><th>Transportadora</th><th>Responsable</th><th className={styles.num}>Guías</th><th>Creada por</th><th /></tr></thead>
              <tbody>
                {relations.map((relation) => (
                  <tr key={relation.id}>
                    <td><strong>{relation.codigo}</strong></td>
                    <td>{formatDate(relation.fecha)}</td>
                    <td>{relation.transportadora_nombre}</td>
                    <td>{relation.responsable || '—'}</td>
                    <td className={styles.num}>{relation.total_guias ?? '—'}</td>
                    <td>{relation.creada_por_nombre || '—'}<div className={styles.muted}>{formatMoment(relation.created_at)}</div></td>
                    <td><button type="button" className={styles.linkBtn} onClick={() => pdf(relation)}>Descargar PDF</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  )
}
