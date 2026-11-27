import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { apiGet, apiRequest } from '../../api/client'
import { useAuth } from '../../auth/session'
import { useToast } from '../ui/toastContext'
import ListPager from '../ui/ListPager'
import Modal from '../ui/Modal'
import { usePersistedFilters } from '../ui/usePersistedFilters'
import { fieldErrors, formatDate } from '../Inventory/labels'
import styles from '../Inventory/Inventory.module.css'
import finishedStyles from '../Finished/Finished.module.css'
import salesStyles from './Sales.module.css'
import {
  CARTERA_PAY_NO_GUIDE,
  CARTERA_RETURN,
  CARTERA_WAIT,
  canReconcile,
  carteraAction,
  carteraKpis,
  INVOICE_NOTICE,
  MIN_NO_GUIDE_NOTE,
  money,
} from './sales'
import { downloadInvoicePdf } from './invoiceFile'
import GuideBadge from '../Shipping/GuideBadge'

/**
 * Confirma el recaudo de una factura (HU 7.3 y 7.5): solo con la guía entregada o, si no tiene guía, con una nota que lo justifique.
 * La nota queda en el movimiento de cartera, no en la factura. Usa `POST /api/ventas/facturas/:id/conciliar/` (`ventas.conciliar`).
 * @param {{invoice: object, onDone: function(object), onClose: function()}} props `onDone` recibe la factura actualizada.
 */
function ConfirmPayModal({ invoice, onDone, onClose }) {
  const notify = useToast()
  const [note, setNote] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const withoutGuide = carteraAction(invoice) === CARTERA_PAY_NO_GUIDE

  const submit = async (event) => {
    event.preventDefault()
    if (withoutGuide && note.trim().length < MIN_NO_GUIDE_NOTE) {
      return setError(`La factura no tiene guía: explica cómo se entregó y cobró (mínimo ${MIN_NO_GUIDE_NOTE} caracteres).`)
    }
    setSaving(true)
    setError('')
    try {
      const saved = await apiRequest(`/api/ventas/facturas/${invoice.id}/conciliar/`, { method: 'POST', body: { nota: note.trim() } })
      notify(`Recaudo de ${saved.numero} confirmado. Se sumaron ${money(saved.valor_a_recaudar)} a la caja.`)
      onDone(saved)
    } catch (failure) {
      const errors = fieldErrors(failure)
      setError(errors.guia ?? errors.nota ?? errors.estado_cobro ?? errors.detail ?? failure.message)
      setSaving(false)
    }
  }

  return (
    <Modal title={`Confirmar recaudo · ${invoice.numero}`} onClose={onClose}>
      <form className={styles.form} onSubmit={submit} noValidate>
        <div className={`${salesStyles.reconcileNote} ${salesStyles.reconcileNotePay}`}>
          <strong>¿Confirmar el pago del pedido?</strong>
          <p>
            {withoutGuide
              ? 'Esta factura no tiene guía (entrega en mano o recogida en bodega): escribe cómo se entregó y cómo se cobró.'
              : 'La guía figura como entregada.'}{' '}
            Al confirmar, <strong>{money(invoice.valor_a_recaudar)}</strong> se suman a la caja de la empresa.
          </p>
        </div>

        <dl className={finishedStyles.lotInfo}>
          <div><dt>Cliente</dt><dd>{invoice.cliente_nombre}</dd></div>
          <div><dt>Ciudad</dt><dd>{invoice.cliente_ciudad}</dd></div>
          <div><dt>Transportadora</dt><dd>{invoice.transportadora_nombre || 'Sin transportadora'}</dd></div>
          <div><dt>Guía</dt><dd>{invoice.guia ? <GuideBadge color={invoice.guia.color} name={`${invoice.numero_guia} · ${invoice.guia.estado_nombre}`} /> : 'Sin guía'}</dd></div>
          <div><dt>Total a ingresar</dt><dd><strong>{money(invoice.valor_a_recaudar)}</strong></dd></div>
        </dl>

        <label className={styles.field}>
          {withoutGuide ? `Nota que justifica el cobro (obligatoria, mínimo ${MIN_NO_GUIDE_NOTE} caracteres)` : 'Nota / referencia del giro (opcional)'}
          <input
            type="text"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder={withoutGuide ? 'Ej: Recogió en bodega y pagó en efectivo, recibo 0123' : 'Ej: Giro de la transportadora #12345'}
            maxLength={255}
          />
        </label>
        <p className={styles.hint}>La nota queda en el movimiento de cartera; la factura no se modifica.</p>

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

/**
 * Modal de consulta rápida de una factura, con descarga del PDF (`downloadInvoicePdf`, `GET /api/ventas/facturas/:id/pdf/`).
 * @param {{invoice: object, onClose: function()}} props
 */
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
        {invoice.guia && <div><dt>Estado de la guía</dt><dd><GuideBadge color={invoice.guia.color} name={invoice.guia.estado_nombre} /></dd></div>}
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

const CARTERA_FILTERS = {
  tab: 'POR_COBRAR',
  q: '',
  transportadora: '',
  desde: '',
  hasta: '',
}

/**
 * Ventas · Gestión de cartera (HU 7.3, 7.5 y 7.7), ruta `/ventas/cartera` (`ventas.ver`): facturas por cobrar, pagadas y devueltas con el estado
 * de su guía, filtros combinables persistidos en sesión y paginación en el servidor. Cada factura ofrece solo la acción que corresponde:
 * confirmar el pago (`ventas.conciliar`, guía entregada o sin guía con nota) o ir a Envíos a registrar la devolución (`envios.devolucion`, guía devuelta).
 * El saldo de la caja solo se ve con `ventas.conciliar`.
 * Endpoints: `GET /api/ventas/facturas/`, `GET /api/ventas/cartera/resumen/` y `POST /api/ventas/facturas/:id/conciliar/`.
 */
export default function CarteraPage() {
  const { can } = useAuth()
  const canConcile = can('ventas.conciliar')
  const canReturn = can('envios.devolucion')

  const [pageData, setPageData] = useState(null)
  const [summary, setSummary] = useState(null)
  const [loadError, setLoadError] = useState('')

  const {
    filters,
    page,
    pageSize,
    activeCount,
    setFilter,
    setPage,
    setPageSize,
    clearFilters,
  } = usePersistedFilters('texcore_filters_cartera', CARTERA_FILTERS)

  // Modales
  const [payingInvoice, setPayingInvoice] = useState(null)
  const [viewingInvoice, setViewingInvoice] = useState(null)

  const loadData = useCallback(() => {
    // 1. Cargar facturas paginadas y filtradas en el servidor
    const params = new URLSearchParams({ page: String(page), page_size: String(pageSize) })
    if (filters.tab === 'POR_COBRAR') {
      params.set('estado', 'EMITIDA')
      params.set('estado_cobro', 'POR_COBRAR')
    } else if (filters.tab === 'PAGADO' || filters.tab === 'DEVOLUCION') {
      params.set('estado_cobro', filters.tab)
    }
    if (filters.transportadora) params.set('transportadora', filters.transportadora)
    if (filters.q.trim()) params.set('q', filters.q.trim())
    if (filters.desde) params.set('desde', filters.desde)
    if (filters.hasta) params.set('hasta', filters.hasta)

    apiGet(`/api/ventas/facturas/?${params}`)
      .then((data) => {
        setPageData(data)
        setLoadError('')
      })
      .catch((err) => setLoadError(err.message))

    // 2. Cargar resumen y saldo financiero
    apiGet('/api/ventas/cartera/resumen/')
      .then(setSummary)
      .catch(() => {})
  }, [filters, page, pageSize])

  useEffect(() => {
    const timer = setTimeout(loadData, 200)
    return () => clearTimeout(timer)
  }, [loadData])

  const displayed = pageData?.results ?? null
  // Totales calculados en el servidor (no dependen de cuántas facturas cargó la pantalla)
  const kpis = carteraKpis(summary, displayed)
  const totalTodas = kpis.facturasPorCobrar + kpis.facturasPagadas + kpis.facturasDevueltas

  const handleActionDone = () => {
    setPayingInvoice(null)
    loadData()
  }

  return (
    <div className={styles.page}>
      <header className={styles.pageHeader}>
        <p className={styles.eyebrow}>Ventas y despachos</p>
        <h1>Gestión de Cartera</h1>
        <p className={styles.subtitle}>
          Consulta qué pedidos están pendientes de recaudo y en qué va su guía. El pago se confirma cuando la guía está entregada; la
          devolución se registra en Envíos cuando el paquete devuelto llega a la bodega.
        </p>
      </header>

      <p className={salesStyles.notice} role="note">
        {INVOICE_NOTICE} Cada venta contraentrega permanece pendiente de recaudo hasta que la transportadora gira el dinero o devuelve el paquete.
      </p>

      {loadError && <p className={styles.formError}>{loadError}</p>}

      {/* Tarjetas KPI de Cartera y Saldo Financiero */}
      <div className={salesStyles.kpis}>
        {kpis.saldoFinanciero != null && (
          <div className={salesStyles.kpiFinance}>
            <span>Saldo Financiero de la Empresa</span>
            <strong>{money(kpis.saldoFinanciero)}</strong>
            <small style={{ fontSize: '0.75rem', color: '#166534' }}>Recaudos consolidados en caja</small>
          </div>
        )}
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
            className={`${salesStyles.tabBtn} ${filters.tab === 'POR_COBRAR' ? salesStyles.tabBtnActive : ''}`}
            onClick={() => setFilter('tab', 'POR_COBRAR')}
          >
            ⏳ Pendientes de recaudo ({kpis.facturasPorCobrar})
          </button>
          <button
            type="button"
            className={`${salesStyles.tabBtn} ${filters.tab === 'TODAS' ? salesStyles.tabBtnActive : ''}`}
            onClick={() => setFilter('tab', 'TODAS')}
          >
            Todas las facturas ({totalTodas})
          </button>
          <button
            type="button"
            className={`${salesStyles.tabBtn} ${filters.tab === 'PAGADO' ? salesStyles.tabBtnActive : ''}`}
            onClick={() => setFilter('tab', 'PAGADO')}
          >
            ✅ Pagadas ({kpis.facturasPagadas})
          </button>
          <button
            type="button"
            className={`${salesStyles.tabBtn} ${filters.tab === 'DEVOLUCION' ? salesStyles.tabBtnActive : ''}`}
            onClick={() => setFilter('tab', 'DEVOLUCION')}
          >
            ↩️ Devoluciones ({kpis.facturasDevueltas})
          </button>
        </div>

        {/* Filtros combinables en servidor */}
        <div className={styles.filters}>
          <input
            type="search"
            placeholder="Buscar por factura, cliente, documento o guía…"
            value={filters.q}
            onChange={(e) => setFilter('q', e.target.value)}
            aria-label="Buscar en cartera"
          />
          <select value={filters.transportadora} onChange={(e) => setFilter('transportadora', e.target.value)} aria-label="Filtrar por transportadora">
            <option value="">Todas las transportadoras</option>
            <option value="INTERRAPIDISIMO">Interrapidísimo</option>
            <option value="ENVIA">Envía</option>
            <option value="OTRA">Otra</option>
          </select>
          <label>Desde <input type="date" value={filters.desde} onChange={(e) => setFilter('desde', e.target.value)} /></label>
          <label>Hasta <input type="date" value={filters.hasta} onChange={(e) => setFilter('hasta', e.target.value)} /></label>
        </div>
        <div className={styles.filterSummary}>
          <span>{pageData ? `${pageData.count.toLocaleString('es-CO')} factura(s) encontradas` : 'Consultando cartera…'}</span>
          {activeCount > 0 && (
            <button type="button" className={styles.secondaryBtn} onClick={clearFilters}>
              Limpiar filtros ({activeCount})
            </button>
          )}
        </div>

        {/* Tabla de Cartera */}
        {displayed && displayed.length === 0 && (
          <p className={styles.empty}>
            {filters.tab === 'POR_COBRAR'
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
                  const action = carteraAction(inv)
                  const reconcilable = canConcile && canReconcile(inv)

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
                        {isPending && !isVoided && (inv.guia ? (
                          <div>
                            <GuideBadge color={inv.guia.color} name={inv.guia.estado_nombre} />
                            <div style={{ color: '#475569', marginTop: '0.2rem' }}>
                              {action === CARTERA_WAIT && 'El pago se confirma cuando la guía esté entregada'}
                              {action === CARTERA_RETURN && 'Paquete devuelto: registra la devolución en Envíos'}
                              {action !== CARTERA_WAIT && action !== CARTERA_RETURN && 'Guía entregada: ya puedes confirmar el pago'}
                            </div>
                          </div>
                        ) : <span style={{ color: '#d97706' }}>Sin guía: se concilia con una nota</span>)}
                        {isVoided && <span style={{ color: '#94a3b8' }}>Factura anulada</span>}
                      </td>
                      <td>
                        <div className={salesStyles.cellActions}>
                          {reconcilable && (
                            <button
                              type="button"
                              className={salesStyles.quickBtnPay}
                              title="Confirmar el recaudo y sumarlo a la caja"
                              onClick={() => setPayingInvoice(inv)}
                            >
                              Confirmar pago
                            </button>
                          )}
                          {action === CARTERA_RETURN && canReturn && (
                            <Link
                              to={`/envios/guias?estado=DEVUELTA&q=${encodeURIComponent(inv.numero)}`}
                              className={salesStyles.quickBtnReturn}
                              title="La devolución se registra desde la guía devuelta"
                            >
                              Devolución en Envíos
                            </Link>
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
        {pageData && (
          <ListPager
            count={pageData.count}
            page={pageData.page}
            pageSize={pageData.page_size}
            totalPages={pageData.total_pages}
            onPageChange={setPage}
            onPageSizeChange={setPageSize}
            noun="facturas"
          />
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

      {viewingInvoice && (
        <QuickInvoiceModal
          invoice={viewingInvoice}
          onClose={() => setViewingInvoice(null)}
        />
      )}
    </div>
  )
}

