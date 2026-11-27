import { useCallback, useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { apiGet, apiRequest } from '../../api/client'
import { useToast } from '../ui/toastContext'
import ListPager from '../ui/ListPager'
import Modal from '../ui/Modal'
import { usePersistedFilters } from '../ui/usePersistedFilters'
import { openEvidence } from './evidence'
import { fieldErrors, formatDate, formatQty } from './labels'
import { formatMoney } from './money'
import styles from './Inventory.module.css'

const STATUS_BADGE = { EN_PROCESO: styles.badgeInfo, COMPLETADA: styles.badgeOk, ANULADA: styles.badgeOff }
const REASONS = {
  COMPRA: 'Compra',
  RETORNO_ORDEN: 'Retorno de orden',
  SALIDA_ORDEN: 'Salida por orden',
  ANULACION: 'Anulación',
}

function EvidenceLinks({ items }) {
  const notify = useToast()
  if (!items?.length) return <span className={styles.muted}>Sin evidencias</span>
  return (
    <ul className={styles.fileList}>
      {items.map((item) => (
        <li key={item.id} className={styles.fileItem}>
          <span>{item.nombre_original}</span>
          <button
            type="button" className={styles.linkBtn}
            onClick={() => openEvidence(item.id).catch((error) => notify(error.message, 'error'))}
          >
            Ver
          </button>
        </li>
      ))}
    </ul>
  )
}

function OrderDetail({ order, canManage, onClose, onCancelled }) {
  const notify = useToast()
  const [reason, setReason] = useState('')
  const [asking, setAsking] = useState(false)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  const cancel = async (event) => {
    event.preventDefault()
    setSaving(true)
    setError('')
    try {
      await apiRequest(`/api/inventario/ordenes/${order.id}/anular/`, { method: 'POST', body: { motivo: reason } })
      notify(`Orden ${order.codigo} anulada. El stock volvió al inventario.`)
      onCancelled()
    } catch (e) {
      setError(fieldErrors(e).motivo ?? fieldErrors(e).detail ?? e.message)
      setSaving(false)
    }
  }

  return (
    <Modal title={`Orden ${order.codigo}`} onClose={onClose}>
      <dl className={styles.detailList}>
        <dt>Tipo</dt><dd>{order.tipo_nombre}</dd>
        <dt>Estado</dt><dd>{order.estado_nombre}</dd>
        <dt>Fecha de salida</dt><dd>{formatDate(order.fecha_salida)}</dd>
        <dt>Responsable</dt><dd>{order.responsable}</dd>
        {order.destino && (<><dt>Destino</dt><dd>{order.destino}</dd></>)}
        {order.referencia
          ? (<><dt>Referencia</dt><dd>{order.referencia_codigo} · {order.referencia_nombre}</dd></>)
          : (<><dt>Ficha técnica</dt><dd>{order.ficha_tecnica}</dd></>)}
        <dt>Resultado</dt><dd>{order.producto_resultado_nombre}</dd>
        {order.cantidad_prendas && (<><dt>Prendas</dt><dd>{formatQty(order.cantidad_prendas)}</dd></>)}
        <dt>Registró</dt><dd>{order.registrado_por_nombre}</dd>
        {order.motivo_anulacion && (<><dt>Motivo de anulación</dt><dd>{order.motivo_anulacion}</dd></>)}
      </dl>
      {order.observaciones && <p className={styles.muted}>{order.observaciones}</p>}

      <h3 className={styles.subhead}>Lo que salió</h3>
      <table className={styles.table}>
        <tbody>
          {order.lineas.map((line) => (
            <tr key={line.producto}>
              <td>{line.nombre}</td>
              <td className={styles.num}>{formatQty(line.cantidad, line.unidad)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <h3 className={styles.subhead}>Evidencias</h3>
      <EvidenceLinks items={order.evidencias} />

      {order.tipo === 'LAVANDERIA' && (
        <p className={styles.muted} style={{ marginTop: '1rem' }}>
          Orden provisional histórica en solo lectura (HU 5.3). Los envíos a lavandería ahora se registran desde{' '}
          <Link to="/lavanderia/remisiones" className={styles.textLink}>Producción → Lavandería</Link>.
        </p>
      )}

      {canManage && order.estado === 'EN_PROCESO' && order.tipo !== 'LAVANDERIA' && (
        asking ? (
          <form className={styles.form} onSubmit={cancel} style={{ marginTop: '1rem' }}>
            <label className={styles.field}>
              Motivo de la anulación
              <input value={reason} onChange={(e) => setReason(e.target.value)} maxLength={255} required autoFocus />
            </label>
            {error && <span className={styles.fieldError}>{error}</span>}
            <div className={styles.actions}>
              <button type="button" className={styles.secondaryBtn} onClick={() => setAsking(false)}>Volver</button>
              <button type="submit" className={styles.dangerBtn} disabled={saving}>Anular y devolver stock</button>
            </div>
          </form>
        ) : (
          <div className={styles.actions} style={{ marginTop: '1rem' }}>
            <button type="button" className={styles.dangerBtn} onClick={() => setAsking(true)}>Anular orden</button>
          </div>
        )
      )}
    </Modal>
  )
}

function OrdersList({ canManage, refreshKey, onChanged }) {
  const [orders, setOrders] = useState(null)
  const [error, setError] = useState('')
  const [tipo, setTipo] = useState('')
  const [estado, setEstado] = useState('')
  const [selected, setSelected] = useState(null)

  const load = useCallback(() => {
    const params = new URLSearchParams()
    if (tipo) params.set('tipo', tipo)
    if (estado) params.set('estado', estado)
    apiGet(`/api/inventario/ordenes/?${params}`)
      .then((data) => (setOrders(data), setError('')))
      .catch((e) => setError(e.message))
  }, [tipo, estado])
  useEffect(load, [load, refreshKey])

  return (
    <>
      <div className={styles.filters}>
        <select value={tipo} onChange={(e) => setTipo(e.target.value)} aria-label="Tipo de orden">
          <option value="">Todos los tipos</option>
          <option value="PRODUCCION">Producción (OP)</option>
          <option value="LAVANDERIA">Lavandería (LV · histórico)</option>
        </select>
        <select value={estado} onChange={(e) => setEstado(e.target.value)} aria-label="Estado">
          <option value="">Todos los estados</option>
          <option value="EN_PROCESO">En proceso</option>
          <option value="COMPLETADA">Completadas</option>
          <option value="ANULADA">Anuladas</option>
        </select>
      </div>
      {error && <p className={styles.formError}>{error}</p>}
      {orders && orders.length === 0 && <p className={styles.empty}>No hay órdenes con ese filtro.</p>}
      {orders && orders.length > 0 && (
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr><th>Orden</th><th>Fecha</th><th>Responsable</th><th>Resultado</th><th>Estado</th><th /></tr>
            </thead>
            <tbody>
              {orders.map((order) => (
                <tr key={order.id}>
                  <td><strong>{order.codigo}</strong></td>
                  <td>{formatDate(order.fecha_salida)}</td>
                  <td>{order.responsable}</td>
                  <td>{order.producto_resultado_nombre}</td>
                  <td><span className={`${styles.badge} ${STATUS_BADGE[order.estado]}`}>{order.estado_nombre}</span></td>
                  <td className={styles.num}>
                    <button type="button" className={styles.linkBtn} onClick={() => setSelected(order)}>Ver detalle</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {selected && (
        <OrderDetail
          order={selected} canManage={canManage} onClose={() => setSelected(null)}
          onCancelled={() => { setSelected(null); load(); onChanged() }}
        />
      )}
    </>
  )
}

const KARDEX_FILTERS = {
  q: '',
  tipo: '',
  producto: '',
  referencia: '',
  lote: '',
  orden_compra: '',
  estado: '',
  responsable: '',
  desde: '',
  hasta: '',
}

function Kardex({ products, refreshKey, initialOrderCode = '' }) {
  const [pageData, setPageData] = useState(null)
  const [references, setReferences] = useState([])
  const [error, setError] = useState('')
  const {
    filters,
    page,
    pageSize,
    activeCount,
    setFilter,
    setPage,
    setPageSize,
    clearFilters,
  } = usePersistedFilters('texcore_filters_kardex', { ...KARDEX_FILTERS, orden_compra: initialOrderCode }, { preserveParams: ['vista'] })

  useEffect(() => {
    apiGet('/api/referencias/?limit=200').then(setReferences).catch(() => {})
  }, [])

  useEffect(() => {
    const params = new URLSearchParams({ page: String(page), page_size: String(pageSize) })
    if (filters.q.trim()) params.set('q', filters.q.trim())
    if (filters.tipo) params.set('tipo', filters.tipo)
    if (filters.producto) params.set('producto', filters.producto)
    if (filters.referencia) params.set('referencia', filters.referencia)
    if (filters.lote.trim()) params.set('lote', filters.lote.trim())
    if (filters.orden_compra.trim()) params.set('orden_compra', filters.orden_compra.trim())
    if (filters.estado) params.set('estado', filters.estado)
    if (filters.responsable.trim()) params.set('responsable', filters.responsable.trim())
    if (filters.desde) params.set('desde', filters.desde)
    if (filters.hasta) params.set('hasta', filters.hasta)
    const timer = setTimeout(() => {
      apiGet(`/api/inventario/movimientos/?${params}`)
        .then((data) => (setPageData(data), setError('')))
        .catch((e) => setError(e.message))
    }, 200)
    return () => clearTimeout(timer)
  }, [filters, page, pageSize, refreshKey])

  const rows = pageData?.results ?? null

  return (
    <>
      <div className={styles.filters}>
        <input type="search" placeholder="Producto, lote, orden, proveedor o nota" value={filters.q} onChange={(e) => setFilter('q', e.target.value)} aria-label="Buscar movimientos" />
        <select value={filters.tipo} onChange={(e) => setFilter('tipo', e.target.value)} aria-label="Tipo de movimiento">
          <option value="">Ingresos y salidas</option>
          <option value="INGRESO">Solo ingresos</option>
          <option value="SALIDA">Solo salidas</option>
        </select>
        <select value={filters.producto} onChange={(e) => setFilter('producto', e.target.value)} aria-label="Producto">
          <option value="">Todos los productos</option>
          {products.map((p) => (
            <option key={p.id} value={p.id}>{p.nombre}</option>
          ))}
        </select>
        <select value={filters.referencia} onChange={(e) => setFilter('referencia', e.target.value)} aria-label="Referencia de la orden">
          <option value="">Todas las referencias</option>
          {references.map((r) => (
            <option key={r.id} value={r.id}>{r.codigo} · {r.nombre}</option>
          ))}
        </select>
        <select value={filters.estado} onChange={(e) => setFilter('estado', e.target.value)} aria-label="Estado de la orden">
          <option value="">Todos los estados de orden</option>
          <option value="EN_PROCESO">En proceso</option>
          <option value="COMPLETADA">Completadas</option>
          <option value="ANULADA">Anuladas</option>
        </select>
        <input type="text" placeholder="Lote" value={filters.lote} onChange={(e) => setFilter('lote', e.target.value)} aria-label="Filtrar por lote" />
        <input
          type="search"
          placeholder="Orden de compra (ej. OC-0001)"
          value={filters.orden_compra}
          onChange={(e) => setFilter('orden_compra', e.target.value)}
          aria-label="Filtrar por orden de compra"
        />
        <input type="text" placeholder="Responsable" value={filters.responsable} onChange={(e) => setFilter('responsable', e.target.value)} aria-label="Filtrar por responsable" />
        <label>Desde <input type="date" value={filters.desde} onChange={(e) => setFilter('desde', e.target.value)} /></label>
        <label>Hasta <input type="date" value={filters.hasta} onChange={(e) => setFilter('hasta', e.target.value)} /></label>
      </div>
      <div className={styles.filterSummary}>
        <span>{pageData ? `${pageData.count.toLocaleString('es-CO')} movimiento(s) encontrados` : 'Consultando movimientos…'}</span>
        {activeCount > 0 && (
          <button type="button" className={styles.secondaryBtn} onClick={clearFilters}>
            Limpiar filtros ({activeCount})
          </button>
        )}
      </div>
      {error && <p className={styles.formError}>{error}</p>}
      {rows && rows.length === 0 && <p className={styles.empty}>No hay movimientos con ese filtro.</p>}
      {rows && rows.length > 0 && (
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Fecha</th><th>Producto</th><th>Movimiento</th><th className={styles.num}>Cantidad</th>
                <th className={styles.num}>Costo unit.</th><th className={styles.num}>Saldo</th><th>Detalle</th><th>Registró</th><th>Evidencias</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const detailParts = [
                  row.orden_codigo,
                  row.proveedor_nombre,
                  row.recepcion_codigo,
                  row.lote && `Lote ${row.lote}`,
                ].filter(Boolean)
                return (
                  <tr key={row.id}>
                    <td>{formatDate(row.fecha)}</td>
                    <td>{row.producto_nombre}</td>
                    <td>
                      <span className={`${styles.badge} ${row.tipo === 'INGRESO' ? styles.badgeOk : styles.badgeWarn}`}>
                        {row.tipo === 'INGRESO' ? 'Ingreso' : 'Salida'}
                      </span>
                      <span className={styles.muted}> {REASONS[row.motivo]}</span>
                    </td>
                    <td className={styles.num}>{row.tipo === 'INGRESO' ? '+' : '−'}{formatQty(row.cantidad, row.unidad)}</td>
                    <td className={styles.num}>{row.costo_unitario ? formatMoney(row.costo_unitario) : '—'}</td>
                    <td className={styles.num}>{formatQty(row.stock_despues, row.unidad)}</td>
                    <td>
                      {row.orden_compra ? (
                        <>
                          <Link
                            className={styles.textLink}
                            to={`/compras/ordenes?orden=${encodeURIComponent(row.orden_compra_id ?? row.orden_compra)}`}
                          >
                            {row.orden_compra}
                          </Link>
                          {detailParts.length > 0 && ` · ${detailParts.join(' · ')}`}
                        </>
                      ) : (
                        detailParts.join(' · ') || '—'
                      )}
                    </td>
                    <td>{row.registrado_por_nombre || '—'}</td>
                    <td><EvidenceLinks items={row.evidencias} /></td>
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
          noun="movimientos"
        />
      )}
    </>
  )
}

/** Historial de inventario: kardex de movimientos y lista de órdenes de salida, con la anulación de las que están en proceso. */
export default function HistoryTab({ products, canManage, refreshKey, onChanged }) {
  const [searchParams] = useSearchParams()
  const initialOrderCode = searchParams.get('orden_compra') ?? ''
  const [view, setView] = useState(() =>
    searchParams.get('vista') === 'kardex' || initialOrderCode ? 'kardex' : 'ordenes',
  )
  return (
    <section className={styles.card}>
      <div className={styles.cardHead}>
        <h2 className={styles.cardTitle}>Historial</h2>
        <div className={styles.tabs} style={{ marginBottom: 0 }}>
          {[['ordenes', 'Órdenes'], ['kardex', 'Kardex de movimientos']].map(([id, label]) => (
            <button
              key={id} type="button" onClick={() => setView(id)}
              className={`${styles.tab} ${view === id ? styles.tabActive : ''}`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
      {view === 'ordenes' ? (
        <OrdersList canManage={canManage} refreshKey={refreshKey} onChanged={onChanged} />
      ) : (
        <Kardex key={initialOrderCode} products={products} refreshKey={refreshKey} initialOrderCode={initialOrderCode} />
      )}
    </section>
  )
}
