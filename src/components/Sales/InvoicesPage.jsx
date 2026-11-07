import { useCallback, useEffect, useState } from 'react'
import { apiGet, apiRequest } from '../../api/client'
import { useAuth } from '../../auth/session'
import { useToast } from '../ui/toastContext'
import Modal from '../ui/Modal'
import { fieldErrors, formatDate } from '../Inventory/labels'
import styles from '../Inventory/Inventory.module.css'
import finishedStyles from '../Finished/Finished.module.css'
import salesStyles from './Sales.module.css'
import { downloadInvoicePdf } from './invoiceFile'
import { INVOICE_NOTICE, money } from './sales'

// Anulación con motivo: las unidades vuelven al inventario y el número de la factura no se reutiliza.
function CancelForm({ invoice, minimum, onDone, onClose }) {
  const notify = useToast()
  const [reason, setReason] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  const submit = async (event) => {
    event.preventDefault()
    if (reason.trim().length < minimum) return setError(`Explica por qué se anula (mínimo ${minimum} caracteres).`)
    if (!window.confirm(`¿Anular la factura ${invoice.numero}? Las unidades vuelven al inventario y esto no se puede deshacer.`)) return
    setSaving(true)
    try {
      const saved = await apiRequest(`/api/ventas/facturas/${invoice.id}/anular/`, { method: 'POST', body: { motivo: reason.trim() } })
      notify(`Factura ${saved.numero} anulada. Las unidades volvieron al inventario.`)
      onDone(saved)
    } catch (failure) {
      setError(fieldErrors(failure).motivo ?? fieldErrors(failure).detail ?? failure.message)
      setSaving(false)
    }
  }

  return (
    <Modal title={`Anular ${invoice.numero}`} onClose={onClose}>
      <form className={styles.form} onSubmit={submit} noValidate>
        <label className={styles.field}>
          Motivo de la anulación
          <textarea value={reason} onChange={(event) => setReason(event.target.value)} maxLength={255} rows={3} aria-label="Motivo de la anulación" />
        </label>
        {error && <p className={styles.formError}>{error}</p>}
        <div className={styles.actions}>
          <button type="button" className={styles.secondaryBtn} onClick={onClose}>Cancelar</button>
          <button type="submit" className={styles.primaryBtn} disabled={saving}>{saving ? 'Anulando…' : 'Anular factura'}</button>
        </div>
      </form>
    </Modal>
  )
}

// Detalle de una factura (solo lectura): líneas con su precio, descuento e IVA del momento, PDF y, con permiso, anulación.
function InvoiceDetail({ invoice, canCancel, meta, onChanged, onClose }) {
  const [cancelling, setCancelling] = useState(false)
  const [error, setError] = useState('')
  const voided = invoice.estado === 'ANULADA'

  const pdf = async () => {
    setError('')
    try {
      await downloadInvoicePdf(invoice)
    } catch (failure) {
      setError(failure.message)
    }
  }

  return (
    <Modal title={`Factura ${invoice.numero}`} onClose={onClose} wide>
      <p className={salesStyles.notice}>{INVOICE_NOTICE}</p>
      {voided && <p className={salesStyles.voided}>ANULADA por {invoice.anulada_por_nombre || '—'}: {invoice.motivo_anulacion}</p>}
      <dl className={finishedStyles.lotInfo}>
        <div><dt>Cliente</dt><dd>{invoice.cliente_nombre}</dd></div>
        <div><dt>Documento</dt><dd>{invoice.cliente_documento}</dd></div>
        <div><dt>Ciudad</dt><dd>{invoice.cliente_ciudad}</dd></div>
        <div><dt>Dirección</dt><dd>{invoice.cliente_direccion}</dd></div>
        <div><dt>Fecha</dt><dd>{formatDate(invoice.fecha)}</dd></div>
        <div><dt>Vendedor</dt><dd>{invoice.vendedor_nombre || '—'}</dd></div>
        <div><dt>Pago</dt><dd>Contraentrega · {invoice.estado_cobro_nombre || (invoice.estado_cobro === 'POR_COBRAR' ? 'por cobrar' : invoice.estado_cobro)}</dd></div>
        <div><dt>Transportadora</dt><dd>{invoice.transportadora_nombre || 'Por definir'} · guía {invoice.numero_guia || 'por asignar'}</dd></div>
        {invoice.fecha_cobro && (
          <div><dt>Conciliación</dt><dd>{formatDate(invoice.fecha_cobro.slice(0, 10))} · por {invoice.cobrado_por_nombre || '—'}</dd></div>
        )}
        {invoice.motivo_devolucion && (
          <div><dt>Motivo devolución</dt><dd>{invoice.motivo_devolucion}</dd></div>
        )}
      </dl>
      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr><th>Referencia</th><th>Talla y color</th><th className={styles.num}>Cant.</th><th className={styles.num}>Precio</th><th className={styles.num}>Desc.</th><th className={styles.num}>Base</th><th className={styles.num}>IVA</th><th className={styles.num}>Total</th></tr>
          </thead>
          <tbody>
            {invoice.lineas.map((line) => (
              <tr key={line.id}>
                <td>{line.referencia_codigo} · {line.referencia_nombre}</td>
                <td>{line.talla} · {line.color}</td>
                <td className={styles.num}>{line.cantidad}</td>
                <td className={styles.num}>{money(line.precio_unitario)}</td>
                <td className={styles.num}>{line.descuento_pct} %</td>
                <td className={styles.num}>{money(line.base)}</td>
                <td className={styles.num}>{money(line.iva)}</td>
                <td className={styles.num}>{money(line.total)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className={salesStyles.totals}>
        <div><span>Subtotal</span><span>{money(invoice.subtotal)}</span></div>
        <div><span>Descuento</span><span>−{money(invoice.descuento_total)}</span></div>
        <div><span>Base gravable</span><span>{money(invoice.base_gravable)}</span></div>
        <div><span>IVA {invoice.iva_tarifa} %</span><span>{money(invoice.iva_total)}</span></div>
        <div className={salesStyles.grand}><span>Total a pagar</span><span>{money(invoice.total)}</span></div>
      </div>
      {invoice.observaciones && <p className={finishedStyles.note}>Observaciones: {invoice.observaciones}</p>}
      {error && <p className={styles.formError}>{error}</p>}
      <div className={styles.actions}>
        {canCancel && !voided && <button type="button" className={styles.secondaryBtn} onClick={() => setCancelling(true)}>Anular</button>}
        <button type="button" className={styles.primaryBtn} onClick={pdf}>Descargar PDF</button>
      </div>
      {cancelling && (
        <CancelForm invoice={invoice} minimum={meta?.motivo_anulacion_minimo ?? 10} onClose={() => setCancelling(false)} onDone={(saved) => { setCancelling(false); onChanged(saved) }} />
      )}
    </Modal>
  )
}

// Ventas · Facturas: las facturas POS internas emitidas, con filtros básicos, detalle, PDF y anulación (`ventas.anular`).
export default function InvoicesPage() {
  const { can } = useAuth()
  const [invoices, setInvoices] = useState(null)
  const [meta, setMeta] = useState(null)
  const [search, setSearch] = useState('')
  const [state, setState] = useState('')
  const [collectState, setCollectState] = useState('')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [loadError, setLoadError] = useState('')
  const [viewing, setViewing] = useState(null)

  const load = useCallback(() => {
    const params = new URLSearchParams({ limit: '200' })
    if (search.trim()) params.set('q', search.trim())
    if (state) params.set('estado', state)
    if (collectState) params.set('estado_cobro', collectState)
    if (from) params.set('desde', from)
    if (to) params.set('hasta', to)
    apiGet(`/api/ventas/facturas/?${params}`).then((data) => (setInvoices(data), setLoadError(''))).catch((error) => setLoadError(error.message))
  }, [search, state, collectState, from, to])

  useEffect(() => {
    apiGet('/api/ventas/metadatos/').then(setMeta).catch(() => {})
  }, [])

  useEffect(() => {
    const timer = setTimeout(load, 250)
    return () => clearTimeout(timer)
  }, [load])

  return (
    <div className={styles.page}>
      <header className={styles.pageHeader}>
        <p className={styles.eyebrow}>Ventas y despachos</p>
        <h1>Facturas</h1>
        <p className={styles.subtitle}>{INVOICE_NOTICE} Una factura no se edita ni se borra: si hay un error se anula y las unidades vuelven al inventario.</p>
      </header>

      <section className={styles.card}>
        <div className={styles.filters}>
          <input type="search" placeholder="Buscar por factura, cliente o documento" value={search} onChange={(event) => setSearch(event.target.value)} aria-label="Buscar facturas" />
          <select value={state} onChange={(event) => setState(event.target.value)} aria-label="Filtrar por estado">
            <option value="">Todos los estados</option>
            <option value="EMITIDA">Emitidas</option>
            <option value="ANULADA">Anuladas</option>
          </select>
          <select value={collectState} onChange={(event) => setCollectState(event.target.value)} aria-label="Filtrar por cobro">
            <option value="">Todo recaudo</option>
            <option value="POR_COBRAR">Por cobrar</option>
            <option value="PAGADO">Pagadas</option>
            <option value="DEVOLUCION">Devoluciones</option>
          </select>
          <label>Desde <input type="date" value={from} onChange={(event) => setFrom(event.target.value)} /></label>
          <label>Hasta <input type="date" value={to} onChange={(event) => setTo(event.target.value)} /></label>
        </div>
        {loadError && <p className={styles.formError}>{loadError}</p>}
        {invoices && invoices.length === 0 && <p className={styles.empty}>No hay facturas con ese filtro.</p>}
        {invoices && invoices.length > 0 && (
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr><th>Factura</th><th>Fecha</th><th>Cliente</th><th>Ciudad</th><th className={styles.num}>Unidades</th><th className={styles.num}>Total</th><th>Estado</th><th>Recaudo</th><th>Vendedor</th><th /></tr>
              </thead>
              <tbody>
                {invoices.map((invoice) => (
                  <tr key={invoice.id} className={invoice.estado === 'ANULADA' ? salesStyles.rowVoided : ''}>
                    <td><strong>{invoice.numero}</strong></td>
                    <td>{formatDate(invoice.fecha)}</td>
                    <td>{invoice.cliente_nombre}</td>
                    <td>{invoice.cliente_ciudad}</td>
                    <td className={styles.num}>{invoice.unidades}</td>
                    <td className={styles.num}>{money(invoice.total)}</td>
                    <td>{invoice.estado === 'ANULADA' ? 'Anulada' : 'Emitida'}</td>
                    <td>
                      {invoice.estado_cobro === 'PAGADO' ? (
                        <span className={salesStyles.badgePaid}>Pagado</span>
                      ) : invoice.estado_cobro === 'DEVOLUCION' ? (
                        <span className={salesStyles.badgeReturned}>Devolución</span>
                      ) : (
                        <span className={salesStyles.badgePending}>Por cobrar</span>
                      )}
                    </td>
                    <td>{invoice.vendedor_nombre || '—'}</td>
                    <td><button type="button" className={styles.linkBtn} onClick={() => setViewing(invoice)}>Ver</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {viewing && (
        <InvoiceDetail invoice={viewing} meta={meta} canCancel={can('ventas.anular')} onClose={() => setViewing(null)} onChanged={(saved) => { setViewing(saved); load() }} />
      )}
    </div>
  )
}
