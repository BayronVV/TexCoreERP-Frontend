import { useCallback, useEffect, useState } from 'react'
import { apiGet, apiRequest } from '../../api/client'
import { useAuth } from '../../auth/session'
import { useToast } from '../ui/toastContext'
import { fieldErrors, formatDate } from '../Inventory/labels'
import styles from '../Inventory/Inventory.module.css'
import shipStyles from './Shipping.module.css'
import {
  guideBody, guideProblems, hoursWithoutGuide, money, pendingCounts, sortPending, urgencyLabel, urgencyMessage,
} from './shipping'

const ROW_CLASS = { atencion: shipStyles.rowAtencion, vencida: shipStyles.rowVencida }
const URGENCY_CLASS = { normal: shipStyles.urgencyNormal, atencion: shipStyles.urgencyAtencion, vencida: shipStyles.urgencyVencida }

// Formulario rápido de una fila: transportadora y número de guía. Al guardar, la factura sale de la lista.
function QuickGuide({ invoice, carriers, onSaved }) {
  const notify = useToast()
  const [carrier, setCarrier] = useState('')
  const [number, setNumber] = useState('')
  const [error, setError] = useState('')
  const [warning, setWarning] = useState('')
  const [saving, setSaving] = useState(false)

  const submit = async (event) => {
    event.preventDefault()
    const problems = guideProblems(carrier, number)
    if (problems.length) return setError(problems[0])
    setSaving(true)
    setError('')
    try {
      const saved = await apiRequest(`/api/envios/facturas/${invoice.id}/guia/`, { method: 'POST', body: guideBody(carrier, number) })
      notify(`Guía de ${invoice.numero} anotada.`)
      if (saved.aviso_formato) notify(saved.aviso_formato, 'warn')
      onSaved(invoice.id)
    } catch (failure) {
      const errors = fieldErrors(failure)
      setError(errors.numero_guia ?? errors.transportadora ?? errors.detail ?? failure.message)
      setWarning(failure.body?.aviso_formato ?? '')
      setSaving(false)
    }
  }

  return (
    <form onSubmit={submit} noValidate>
      <div className={shipStyles.quick}>
        <select value={carrier} onChange={(event) => setCarrier(event.target.value)} aria-label={`Transportadora de ${invoice.numero}`}>
          <option value="">Transportadora</option>
          {carriers.map((item) => <option key={item.codigo} value={item.codigo}>{item.nombre}</option>)}
        </select>
        <input value={number} onChange={(event) => setNumber(event.target.value)} maxLength={40} placeholder="Número de guía" aria-label={`Número de guía de ${invoice.numero}`} />
        <button type="submit" className={styles.primaryBtn} disabled={saving}>{saving ? 'Guardando…' : 'Anotar guía'}</button>
      </div>
      {warning && <span className={styles.muted}>{warning}</span>}
      {error && <span className={styles.fieldError} role="alert">{error}</span>}
    </form>
  )
}

// Envíos · Por despachar: las facturas que todavía no tienen guía, las más antiguas primero. La guía se genera en la transportadora
// antes de facturar; si no se tenía a mano, se anota aquí cuanto antes.
export default function PendingPage() {
  const { can } = useAuth()
  const [rows, setRows] = useState(null)
  const [meta, setMeta] = useState(null)
  const [loadError, setLoadError] = useState('')
  const canNote = can('envios.anotar')

  const load = useCallback(() => {
    apiGet('/api/envios/pendientes/').then((data) => (setRows(data), setLoadError(''))).catch((error) => setLoadError(error.message))
  }, [])

  useEffect(() => {
    load()
    apiGet('/api/envios/metadatos/').then(setMeta).catch((error) => setLoadError(error.message))
  }, [load])

  const sorted = sortPending(rows)
  const counts = pendingCounts(rows)

  return (
    <div className={styles.page}>
      <header className={styles.pageHeader}>
        <p className={styles.eyebrow}>Envíos</p>
        <h1>Por despachar · facturas sin guía</h1>
        <p className={styles.subtitle}>Anota la guía lo antes posible: sin ella la factura no se puede despachar ni rastrear.</p>
      </header>

      {loadError && <p className={styles.formError}>{loadError}</p>}

      {rows && counts.total > 0 && (
        <div className={`${shipStyles.alert} ${counts.vencidas ? shipStyles.alertVencida : shipStyles.alertAtencion}`} role="status">
          <div>
            <strong>{counts.total} {counts.total === 1 ? 'factura sin guía' : 'facturas sin guía'}</strong>
            <p>{counts.vencidas} vencida(s) · {counts.atencion} con atención · {counts.normales} a tiempo.</p>
          </div>
        </div>
      )}

      <section className={styles.card}>
        {rows && rows.length === 0 && <p className={styles.empty}>Todas las facturas tienen su guía. No hay nada pendiente.</p>}
        {rows && rows.length > 0 && (
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr><th>Factura</th><th>Cliente</th><th>Vendedor</th><th className={styles.num}>Total</th><th>Sin guía</th>{canNote && <th>Anotar guía</th>}</tr>
              </thead>
              <tbody>
                {sorted.map((invoice) => (
                  <tr key={invoice.id} className={ROW_CLASS[invoice.urgencia] ?? ''}>
                    <td><strong>{invoice.numero}</strong><div className={styles.muted}>{formatDate(invoice.fecha)}</div></td>
                    <td>{invoice.cliente_nombre}<div className={styles.muted}>{invoice.cliente_ciudad}</div></td>
                    <td>{invoice.vendedor_nombre || '—'}</td>
                    <td className={styles.num}>{money(invoice.total)}</td>
                    <td>
                      <span className={`${shipStyles.urgency} ${URGENCY_CLASS[invoice.urgencia] ?? URGENCY_CLASS.normal}`}>{urgencyLabel(invoice.urgencia)}</span>
                      <div className={styles.muted}>{hoursWithoutGuide(invoice.horas_sin_guia)}</div>
                      {invoice.urgencia !== 'normal' && <div className={styles.muted}>{urgencyMessage(invoice.urgencia, meta)}</div>}
                    </td>
                    {canNote && (
                      <td><QuickGuide invoice={invoice} carriers={meta?.transportadoras ?? []} onSaved={(id) => setRows((current) => current.filter((row) => row.id !== id))} /></td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {!canNote && rows && rows.length > 0 && <p className={styles.muted}>Tu rol puede ver esta lista, pero no anotar guías.</p>}
      </section>
    </div>
  )
}
