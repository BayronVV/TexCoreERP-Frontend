import { useCallback, useEffect, useState } from 'react'
import { apiGet, apiRequest } from '../../api/client'
import { useAuth } from '../../auth/session'
import { useToast } from '../ui/toastContext'
import Modal from '../ui/Modal'
import { fieldErrors, formatDate } from '../Inventory/labels'
import styles from '../Inventory/Inventory.module.css'
import finishedStyles from '../Finished/Finished.module.css'
import salesStyles from './Sales.module.css'
import { canReconcile, carteraResume, filterCartera, INVOICE_NOTICE, money } from './sales'
import { downloadInvoicePdf } from './invoiceFile'

// Modal de acción rápida: Confirmar Recaudo (PAGADO) y actualizar saldo financiero de la empresa
function ConfirmPayModal({ invoice, onDone, onClose }) {
  const notify = useToast()
  const [notes, setNotes] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  const submit = async (event) => {
    event.preventDefault()
    setSaving(true)
    setError('')
    try {
      const saved = await apiRequest(`/api/ventas/facturas/${invoice.id}/conciliar/`, {
        method: 'POST',
        body: { estado_cobro: 'PAGADO', observaciones: notes.trim() },
      })
      notify(`Recaudo de ${saved.numero} confirmado. Se sumaron ${money(saved.valor_a_recaudar)} al saldo financiero.`)
      onDone(saved)
    } catch (failure) {
      setError(fieldErrors(failure).estado_cobro ?? fieldErrors(failure).detail ?? failure.message)
      setSaving(false)
    }
  }

  return (
    <Modal title={`Confirmar recaudo · ${invoice.numero}`} onClose={onClose}>
      <form className={styles.form} onSubmit={submit} noValidate>
        <div className={`${salesStyles.reconcileNote} ${salesStyles.reconcileNotePay}`}>
          <strong>¿Confirmar el pago del pedido?</strong>
          <p>
            Al marcar como <strong>Pagado</strong>, el valor a recaudar de <strong>{money(invoice.valor_a_recaudar)}</strong> se sumará
            inmediatamente al saldo financiero de la empresa.
          </p>
        </div>

        <dl className={finishedStyles.lotInfo}>
          <div><dt>Cliente</dt><dd>{invoice.cliente_nombre}</dd></div>
          <div><dt>Ciudad</dt><dd>{invoice.cliente_ciudad}</dd></div>
          <div><dt>Transportadora</dt><dd>{invoice.transportadora_nombre || 'Por definir'}</dd></div>
          <div><dt>Guía</dt><dd>{invoice.numero_guia || 'Sin asignar'}</dd></div>
          <div><dt>Total a ingresar</dt><dd><strong>{money(invoice.valor_a_recaudar)}</strong></dd></div>
        </dl>

        <label className={styles.field}>
          Observaciones / Referencia del giro (opcional)
          <input
            type="text"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Ej: Giro bancario #12345 o consignación recibida"
            maxLength={255}
          />
        </label>

        {error && <p className={styles.formError}>{error}</p>}

        <div className={styles.actions}>
          <button type="button" className={styles.secondaryBtn} onClick={onClose} disabled={saving}>Cancelar</button>
          <button type="submit" className={salesStyles.quickBtnPay} style={{ padding: '0.6rem 1.2rem', fontSize: '0.9rem' }} disabled={saving}>
            {saving ? 'Confirmando…' : `Confirmar recaudo (${money(invoice.valor_a_recaudar)})`}
          </button>
        </div>
      </form>
    </Modal>
  )
}

// Modal de acción rápida: Registrar Devolución y reingresar prendas a producto terminado
function ConfirmReturnModal({ invoice, onDone, onClose }) {
  const notify = useToast()
  const [reason, setReason] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  const submit = async (event) => {
    event.preventDefault()
    if (reason.trim().length < 5) {
      return setError('Escribe el motivo de la devolución (mínimo 5 caracteres).')
    }
    setSaving(true)
    setError('')
    try {
      const saved = await apiRequest(`/api/ventas/facturas/${invoice.id}/conciliar/`, {
        method: 'POST',
        body: { estado_cobro: 'DEVOLUCION', motivo: reason.trim() },
      })
      notify(`Devolución de ${saved.numero} registrada. Las prendas retornaron al inventario de producto terminado.`)
      onDone(saved)
    } catch (failure) {
      setError(fieldErrors(failure).motivo ?? fieldErrors(failure).estado_cobro ?? failure.message)
      setSaving(false)
    }
  }

  return (
    <Modal title={`Registrar devolución · ${invoice.numero}`} onClose={onClose}>
      <form className={styles.form} onSubmit={submit} noValidate>
        <div className={`${salesStyles.reconcileNote} ${salesStyles.reconcileNoteReturn}`}>
          <strong>¿Registrar devolución de mercancía?</strong>
          <p>
            El cliente rechazó o no recibió el paquete. Las unidades de prendas se reingresarán automáticamente al inventario
            de producto terminado (movimiento de devolución) y <strong>no</strong> se sumará dinero al saldo financiero.
          </p>
        </div>

        <dl className={finishedStyles.lotInfo}>
          <div><dt>Cliente</dt><dd>{invoice.cliente_nombre}</dd></div>
          <div><dt>Ciudad</dt><dd>{invoice.cliente_ciudad}</dd></div>
          <div><dt>Prendas</dt><dd>{invoice.unidades} unidades</dd></div>
          <div><dt>Transportadora</dt><dd>{invoice.transportadora_nombre || '—'} (Guía: {invoice.numero_guia || '—'})</dd></div>
        </dl>

        <label className={styles.field}>
          Motivo de la devolución (obligatorio)
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Ej: Cliente ausente en dirección / rechazó el pedido / paquete retornado"
            rows={3}
            maxLength={255}
            required
          />
        </label>

        {error && <p className={styles.formError}>{error}</p>}

        <div className={styles.actions}>
          <button type="button" className={styles.secondaryBtn} onClick={onClose} disabled={saving}>Cancelar</button>
          <button type="submit" className={salesStyles.quickBtnReturn} style={{ padding: '0.6rem 1.2rem', fontSize: '0.9rem' }} disabled={saving}>
            {saving ? 'Registrando…' : 'Registrar devolución'}
          </button>
        </div>
      </form>
    </Modal>
  )
}

// Modal de detalle de factura para consulta rápida y descarga de PDF
function QuickInvoiceModal({ invoice, onClose }) {
  const [error, setError] = useState('')

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
      <dl className={finishedStyles.lotInfo}>
        <div><dt>Cliente</dt><dd>{invoice.cliente_nombre}</dd></div>
        <div><dt>Documento</dt><dd>{invoice.cliente_documento}</dd></div>
        <div><dt>Ciudad</dt><dd>{invoice.cliente_ciudad}</dd></div>
        <div><dt>Dirección</dt><dd>{invoice.cliente_direccion}</dd></div>
        <div><dt>Fecha emisión</dt><dd>{formatDate(invoice.fecha)}</dd></div>
        <div><dt>Vendedor</dt><dd>{invoice.vendedor_nombre || '—'}</dd></div>
        <div><dt>Estado de cobro</dt><dd><strong>{invoice.estado_cobro_nombre || invoice.estado_cobro}</strong></dd></div>
        <div><dt>Transportadora</dt><dd>{invoice.transportadora_nombre || 'Por definir'} · guía {invoice.numero_guia || '—'}</dd></div>
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
            <tr>
              <th>Referencia</th>
              <th>Talla y color</th>
              <th className={styles.num}>Cant.</th>
              <th className={styles.num}>Precio</th>
              <th className={styles.num}>Desc.</th>
              <th className={styles.num}>Total</th>
            </tr>
          </thead>
          <tbody>
            {(invoice.lineas || []).map((line) => (
              <tr key={line.id}>
                <td>{line.referencia_codigo} · {line.referencia_nombre}</td>
                <td>{line.talla} · {line.color}</td>
                <td className={styles.num}>{line.cantidad}</td>
                <td className={styles.num}>{money(line.precio_unitario)}</td>
                <td className={styles.num}>{line.descuento_pct} %</td>
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
        <div className={salesStyles.grand}><span>Total a recaudar</span><span>{money(invoice.total)}</span></div>
      </div>

      {invoice.observaciones && <p className={finishedStyles.note}>Observaciones: {invoice.observaciones}</p>}
      {error && <p className={styles.formError}>{error}</p>}

      <div className={styles.actions}>
        <button type="button" className={styles.secondaryBtn} onClick={onClose}>Cerrar</button>
        <button type="button" className={styles.primaryBtn} onClick={pdf}>Descargar PDF</button>
      </div>
    </Modal>
  )
}

// Tablero para gestión de cartera (HU 7.3 / TE-64)
export default function CarteraPage() {
  const { can } = useAuth()
  const canManage = can('ventas.gestionar')

  const [invoices, setInvoices] = useState(null)
  const [summary, setSummary] = useState(null)
  const [loadError, setLoadError] = useState('')

  // Filtros
  const [tab, setTab] = useState('POR_COBRAR') // Por defecto se muestran los pendientes de recaudo
  const [search, setSearch] = useState('')
  const [carrier, setCarrier] = useState('')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')

  // Modales
  const [payingInvoice, setPayingInvoice] = useState(null)
  const [returningInvoice, setReturningInvoice] = useState(null)
  const [viewingInvoice, setViewingInvoice] = useState(null)

  const loadData = useCallback(() => {
    // 1. Cargar facturas
    const params = new URLSearchParams({ limit: '200' })
    if (from) params.set('desde', from)
    if (to) params.set('hasta', to)
    apiGet(`/api/ventas/facturas/?${params}`)
      .then((data) => {
        setInvoices(data)
        setLoadError('')
      })
      .catch((err) => setLoadError(err.message))

    // 2. Cargar resumen y saldo financiero
    apiGet('/api/ventas/cartera/resumen/')
      .then(setSummary)
      .catch(() => {})
  }, [from, to])

  useEffect(() => {
    const timer = setTimeout(loadData, 200)
    return () => clearTimeout(timer)
  }, [loadData])

  // Cálculo de KPIs locales o combinados con el servidor
  const kpis = carteraResume(invoices, summary?.saldo_financiero ?? 0)

  // Filtrado de filas según los filtros seleccionados
  const displayed = filterCartera(invoices, { tab, search, carrier })

  const handleActionDone = () => {
    setPayingInvoice(null)
    setReturningInvoice(null)
    loadData()
  }

  return (
    <div className={styles.page}>
      <header className={styles.pageHeader}>
        <p className={styles.eyebrow}>Ventas y despachos</p>
        <h1>Gestión de Cartera</h1>
        <p className={styles.subtitle}>
          Consulta qué pedidos están pendientes de recaudo por las transportadoras, y utiliza las acciones rápidas para confirmar el pago
          (actualizando el saldo financiero de la empresa) o registrar devoluciones de mercancía.
        </p>
      </header>

      <p className={salesStyles.notice} role="note">
        {INVOICE_NOTICE} Cada venta contraentrega permanece pendiente de recaudo hasta que la transportadora gira el dinero o devuelve el paquete.
      </p>

      {loadError && <p className={styles.formError}>{loadError}</p>}

      {/* Tarjetas KPI de Cartera y Saldo Financiero */}
      <div className={salesStyles.kpis}>
        <div className={salesStyles.kpiFinance}>
          <span>Saldo Financiero de la Empresa</span>
          <strong>{money(kpis.saldoFinanciero)}</strong>
          <small style={{ fontSize: '0.75rem', color: '#166534' }}>Recaudos consolidados en caja</small>
        </div>
        <div className={salesStyles.kpi}>
          <span>Pendiente de Recaudo</span>
          <strong>{money(kpis.totalPorCobrar)}</strong>
          <small style={{ fontSize: '0.75rem', color: '#b45309' }}>{kpis.facturasPorCobrar} pedido(s) por cobrar</small>
        </div>
        <div className={salesStyles.kpi}>
          <span>Total Recaudado</span>
          <strong>{money(kpis.totalRecaudado)}</strong>
          <small style={{ fontSize: '0.75rem', color: '#15803d' }}>{kpis.facturasPagadas} factura(s) pagada(s)</small>
        </div>
        <div className={salesStyles.kpi}>
          <span>Devoluciones</span>
          <strong>{kpis.facturasDevueltas}</strong>
          <small style={{ fontSize: '0.75rem', color: '#b91c1c' }}>{money(kpis.totalDevoluciones)} en mercancía retornada</small>
        </div>
      </div>

      <section className={styles.card}>
        {/* Pestañas rápidas para gestión de cartera */}
        <div className={salesStyles.tabGroup}>
          <button
            type="button"
            className={`${salesStyles.tabBtn} ${tab === 'POR_COBRAR' ? salesStyles.tabBtnActive : ''}`}
            onClick={() => setTab('POR_COBRAR')}
          >
            ⏳ Pendientes de recaudo ({kpis.facturasPorCobrar})
          </button>
          <button
            type="button"
            className={`${salesStyles.tabBtn} ${tab === 'TODAS' ? salesStyles.tabBtnActive : ''}`}
            onClick={() => setTab('TODAS')}
          >
            Todas las facturas ({invoices?.length ?? 0})
          </button>
          <button
            type="button"
            className={`${salesStyles.tabBtn} ${tab === 'PAGADO' ? salesStyles.tabBtnActive : ''}`}
            onClick={() => setTab('PAGADO')}
          >
            ✅ Pagadas ({kpis.facturasPagadas})
          </button>
          <button
            type="button"
            className={`${salesStyles.tabBtn} ${tab === 'DEVOLUCION' ? salesStyles.tabBtnActive : ''}`}
            onClick={() => setTab('DEVOLUCION')}
          >
            ↩️ Devoluciones ({kpis.facturasDevueltas})
          </button>
        </div>

        {/* Filtros secundarios */}
        <div className={styles.filters}>
          <input
            type="search"
            placeholder="Buscar por factura, cliente, documento o guía…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            aria-label="Buscar en cartera"
          />
          <select value={carrier} onChange={(e) => setCarrier(e.target.value)} aria-label="Filtrar por transportadora">
            <option value="">Todas las transportadoras</option>
            <option value="INTERRAPIDISIMO">Interrapidísimo</option>
            <option value="ENVIA">Envía</option>
            <option value="OTRA">Otra</option>
          </select>
          <label>Desde <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></label>
          <label>Hasta <input type="date" value={to} onChange={(e) => setTo(e.target.value)} /></label>
        </div>

        {/* Tabla de Cartera */}
        {displayed && displayed.length === 0 && (
          <p className={styles.empty}>
            {tab === 'POR_COBRAR'
              ? 'No hay pedidos pendientes de recaudo con los filtros actuales.'
              : 'No se encontraron registros en cartera con los filtros indicados.'}
          </p>
        )}

        {displayed && displayed.length > 0 && (
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Factura</th>
                  <th>Fecha</th>
                  <th>Cliente</th>
                  <th>Transportadora y Guía</th>
                  <th className={styles.num}>Valor a recaudar</th>
                  <th>Estado de recaudo</th>
                  <th>Conciliación</th>
                  <th style={{ textAlign: 'center' }}>Acciones rápidas</th>
                </tr>
              </thead>
              <tbody>
                {displayed.map((inv) => {
                  const isVoided = inv.estado === 'ANULADA'
                  const isPending = inv.estado_cobro === 'POR_COBRAR'
                  const isPaid = inv.estado_cobro === 'PAGADO'
                  const isReturned = inv.estado_cobro === 'DEVOLUCION'
                  const reconcilable = canManage && canReconcile(inv)

                  return (
                    <tr key={inv.id} className={isVoided ? salesStyles.rowVoided : ''}>
                      <td>
                        <strong>{inv.numero}</strong>
                        {isVoided && <span style={{ display: 'block', fontSize: '0.7rem', color: '#b3261e' }}>ANULADA</span>}
                      </td>
                      <td>{formatDate(inv.fecha)}</td>
                      <td>
                        <div><strong>{inv.cliente_nombre}</strong></div>
                        <div style={{ fontSize: '0.75rem', color: '#64748b' }}>{inv.cliente_ciudad} · {inv.cliente_documento}</div>
                      </td>
                      <td>
                        {inv.transportadora_nombre ? (
                          <div>
                            <strong>{inv.transportadora_nombre}</strong>
                            <div style={{ fontSize: '0.75rem', color: '#64748b' }}>Guía: {inv.numero_guia || 'Sin asignar'}</div>
                          </div>
                        ) : (
                          <span style={{ color: '#94a3b8' }}>Por asignar</span>
                        )}
                      </td>
                      <td className={styles.num}>
                        <strong style={{ fontSize: '0.95rem' }}>{money(inv.valor_a_recaudar || inv.total)}</strong>
                        <div style={{ fontSize: '0.72rem', color: '#64748b' }}>{inv.unidades} prenda(s)</div>
                      </td>
                      <td>
                        {isPending && <span className={salesStyles.badgePending}>⏳ Pendiente</span>}
                        {isPaid && <span className={salesStyles.badgePaid}>✅ Pagado</span>}
                        {isReturned && <span className={salesStyles.badgeReturned}>↩️ Devolución</span>}
                      </td>
                      <td style={{ fontSize: '0.8rem' }}>
                        {isPaid && (
                          <div>
                            <span style={{ color: '#166534', fontWeight: 600 }}>Recaudado</span>
                            <div style={{ color: '#64748b' }}>
                              {inv.fecha_cobro ? formatDate(inv.fecha_cobro.slice(0, 10)) : ''}
                              {inv.cobrado_por_nombre ? ` · ${inv.cobrado_por_nombre}` : ''}
                            </div>
                          </div>
                        )}
                        {isReturned && (
                          <div>
                            <span style={{ color: '#991b1b', fontWeight: 600 }}>Mercancía retornada</span>
                            {inv.motivo_devolucion && (
                              <div style={{ color: '#64748b', maxWidth: '180px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={inv.motivo_devolucion}>
                                {inv.motivo_devolucion}
                              </div>
                            )}
                          </div>
                        )}
                        {isPending && !isVoided && <span style={{ color: '#d97706' }}>Esperando reporte de transportadora</span>}
                        {isVoided && <span style={{ color: '#94a3b8' }}>Factura anulada</span>}
                      </td>
                      <td>
                        <div className={salesStyles.cellActions}>
                          {reconcilable && (
                            <>
                              <button
                                type="button"
                                className={salesStyles.quickBtnPay}
                                title="Marcar como pagado y sumar al saldo financiero"
                                onClick={() => setPayingInvoice(inv)}
                              >
                                Pagado
                              </button>
                              <button
                                type="button"
                                className={salesStyles.quickBtnReturn}
                                title="Registrar devolución de mercancía"
                                onClick={() => setReturningInvoice(inv)}
                              >
                                Devolución
                              </button>
                            </>
                          )}
                          <button
                            type="button"
                            className={styles.linkBtn}
                            onClick={() => setViewingInvoice(inv)}
                          >
                            Ver
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Modales de acción rápida */}
      {payingInvoice && (
        <ConfirmPayModal
          invoice={payingInvoice}
          onDone={handleActionDone}
          onClose={() => setPayingInvoice(null)}
        />
      )}

      {returningInvoice && (
        <ConfirmReturnModal
          invoice={returningInvoice}
          onDone={handleActionDone}
          onClose={() => setReturningInvoice(null)}
        />
      )}

      {viewingInvoice && (
        <QuickInvoiceModal
          invoice={viewingInvoice}
          onClose={() => setViewingInvoice(null)}
        />
      )}
    </div>
  )
}

