import { useCallback, useEffect, useState } from 'react'
import { apiGet, apiRequest } from '../../api/client'
import { useToast } from '../ui/toastContext'
import Modal from '../ui/Modal'
import { openEvidence } from './evidence'
import { fieldErrors, formatDate, formatQty } from './labels'
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
        <dt>Ficha técnica</dt><dd>{order.ficha_tecnica}</dd>
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

      {canManage && order.estado === 'EN_PROCESO' && (
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
          <option value="LAVANDERIA">Lavandería (LV)</option>
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

function Kardex({ products, refreshKey }) {
  const [rows, setRows] = useState(null)
  const [error, setError] = useState('')
  const [tipo, setTipo] = useState('')
  const [producto, setProducto] = useState('')

  useEffect(() => {
    const params = new URLSearchParams()
    if (tipo) params.set('tipo', tipo)
    if (producto) params.set('producto', producto)
    apiGet(`/api/inventario/movimientos/?${params}`)
      .then((data) => (setRows(data), setError('')))
      .catch((e) => setError(e.message))
  }, [tipo, producto, refreshKey])

  return (
    <>
      <div className={styles.filters}>
        <select value={tipo} onChange={(e) => setTipo(e.target.value)} aria-label="Tipo de movimiento">
          <option value="">Ingresos y salidas</option>
          <option value="INGRESO">Solo ingresos</option>
          <option value="SALIDA">Solo salidas</option>
        </select>
        <select value={producto} onChange={(e) => setProducto(e.target.value)} aria-label="Producto">
          <option value="">Todos los productos</option>
          {products.map((p) => (
            <option key={p.id} value={p.id}>{p.nombre}</option>
          ))}
        </select>
      </div>
      {error && <p className={styles.formError}>{error}</p>}
      {rows && rows.length === 0 && <p className={styles.empty}>Todavía no hay movimientos.</p>}
      {rows && rows.length > 0 && (
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Fecha</th><th>Producto</th><th>Movimiento</th><th className={styles.num}>Cantidad</th>
                <th className={styles.num}>Saldo</th><th>Detalle</th><th>Registró</th><th>Evidencias</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
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
                  <td className={styles.num}>{formatQty(row.stock_despues, row.unidad)}</td>
                  <td>
                    {[row.orden_codigo, row.proveedor_nombre, row.orden_compra, row.lote && `Lote ${row.lote}`]
                      .filter(Boolean).join(' · ') || '—'}
                  </td>
                  <td>{row.registrado_por_nombre || '—'}</td>
                  <td><EvidenceLinks items={row.evidencias} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  )
}

export default function HistoryTab({ products, canManage, refreshKey, onChanged }) {
  const [view, setView] = useState('ordenes')
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
        <Kardex products={products} refreshKey={refreshKey} />
      )}
    </section>
  )
}
