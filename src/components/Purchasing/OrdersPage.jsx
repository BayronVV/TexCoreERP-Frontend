import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { apiGet, apiRequest } from '../../api/client'
import { useAuth } from '../../auth/session'
import { useToast } from '../ui/toastContext'
import Modal from '../ui/Modal'
import { fieldErrors, formatDate } from '../Inventory/labels'
import { formatMoney } from '../Inventory/money'
import styles from '../Inventory/Inventory.module.css'
import purchasingStyles from './Purchasing.module.css'
import OrderDetail, { OrderBadge, OrderProgress } from './OrderDetail'
import OrderForm from './OrderForm'
import { allowedActions } from './purchasing'

// Pide el motivo para cancelar una orden o cerrarla a mano (solo se usa en esos dos casos).
function ReasonModal({ title, help, confirmLabel, onConfirm, onClose }) {
  const [reason, setReason] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  const submit = async (event) => {
    event.preventDefault()
    if (!reason.trim()) return setError('Indica el motivo.')
    setSaving(true)
    try {
      await onConfirm(reason.trim())
    } catch (failure) {
      setError(fieldErrors(failure).motivo ?? fieldErrors(failure).orden ?? failure.message)
      setSaving(false)
    }
  }

  return (
    <Modal title={title} onClose={onClose}>
      <form className={styles.form} onSubmit={submit}>
        <p className={purchasingStyles.note}>{help}</p>
        <label className={`${styles.field} ${purchasingStyles.reasonBox}`}>
          Motivo
          <textarea value={reason} onChange={(event) => setReason(event.target.value)} maxLength={255} required />
          {error && <span className={styles.fieldError}>{error}</span>}
        </label>
        <div className={styles.actions}>
          <button type="button" className={styles.secondaryBtn} onClick={onClose}>Volver</button>
          <button type="submit" className={styles.primaryBtn} disabled={saving}>{saving ? 'Guardando…' : confirmLabel}</button>
        </div>
      </form>
    </Modal>
  )
}

// Órdenes de compra de materiales: la crea Producción, la aprueba el Gerente y el almacenista recibe la mercancía. Cada
// botón aparece solo si el rol puede usarlo en ese estado; el servidor valida igual.
export default function OrdersPage() {
  const { can } = useAuth()
  const notify = useToast()
  const [orders, setOrders] = useState(null)
  const [states, setStates] = useState([])
  const [loadError, setLoadError] = useState('')
  const [search, setSearch] = useState('')
  const [state, setState] = useState('')
  const [editing, setEditing] = useState(null) // null | 'new' | orden
  const [viewing, setViewing] = useState(null)
  const [reasoning, setReasoning] = useState(null) // { order, kind: 'cancelar' | 'cerrar' }

  const load = useCallback(() => {
    const params = new URLSearchParams()
    if (search.trim()) params.set('q', search.trim())
    if (state) params.set('estado', state)
    params.set('limit', '200')
    apiGet(`/api/compras/ordenes/?${params}`)
      .then((data) => (setOrders(data), setLoadError('')))
      .catch((error) => setLoadError(error.message))
  }, [search, state])

  useEffect(() => {
    const timer = setTimeout(load, 250)
    return () => clearTimeout(timer)
  }, [load])

  useEffect(() => {
    apiGet('/api/compras/metadatos/').then((meta) => setStates(meta.estados)).catch(() => {})
  }, [])

  const approve = async (order) => {
    if (!window.confirm(`¿Aprobar la orden ${order.codigo}? Después ya no se podrá editar y el almacén podrá recibir contra ella.`)) return
    try {
      await apiRequest(`/api/compras/ordenes/${order.id}/aprobar/`, { method: 'POST', body: {} })
      notify(`Orden ${order.codigo} aprobada.`)
      load()
    } catch (error) {
      notify(fieldErrors(error).orden ?? error.message, 'error')
    }
  }

  const confirmReason = async (reason) => {
    const { order, kind } = reasoning
    await apiRequest(`/api/compras/ordenes/${order.id}/${kind}/`, { method: 'POST', body: { motivo: reason } })
    notify(kind === 'cancelar' ? `Orden ${order.codigo} cancelada.` : `Orden ${order.codigo} cerrada.`)
    setReasoning(null)
    load()
  }

  const canCreate = can('compras.gestionar')

  return (
    <div className={styles.page}>
      <header className={`${styles.pageHeader} ${purchasingStyles.headerRow}`}>
        <div>
          <p className={styles.eyebrow}>Compras</p>
          <h1>Órdenes de compra</h1>
          <p className={styles.subtitle}>
            Pedidos de materia prima e insumos a un proveedor. Producción los crea, el Gerente los aprueba y el almacenista recibe la mercancía.
          </p>
        </div>
        {canCreate && <button type="button" className={styles.primaryBtn} onClick={() => setEditing('new')}>+ Nueva orden</button>}
      </header>

      <section className={styles.card}>
        <div className={styles.filters}>
          <input type="search" placeholder="Buscar por código o proveedor" value={search} onChange={(event) => setSearch(event.target.value)} aria-label="Buscar órdenes" />
          <select value={state} onChange={(event) => setState(event.target.value)} aria-label="Filtrar por estado">
            <option value="">Todos los estados</option>
            {states.map((option) => <option key={option.codigo} value={option.codigo}>{option.nombre}</option>)}
          </select>
        </div>
        {loadError && <p className={styles.formError}>{loadError}</p>}
        {orders && orders.length === 0 && (
          <p className={styles.empty}>{search || state ? 'Ninguna orden coincide con el filtro.' : `Todavía no hay órdenes de compra.${canCreate ? ' Crea la primera.' : ''}`}</p>
        )}
        {orders && orders.length > 0 && (
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr><th>Código</th><th>Proveedor</th><th>Fecha</th><th>Esperada</th><th>Estado</th><th>Recepción</th><th className={styles.num}>Valor estimado</th><th /></tr>
              </thead>
              <tbody>
                {orders.map((order) => {
                  const actions = allowedActions(order, can)
                  return (
                    <tr key={order.id}>
                      <td><strong>{order.codigo}</strong></td>
                      <td>{order.proveedor_nombre}</td>
                      <td>{formatDate(order.fecha)}</td>
                      <td>{formatDate(order.fecha_esperada)}</td>
                      <td><OrderBadge order={order} /></td>
                      <td><OrderProgress order={order} /></td>
                      <td className={styles.num}>{formatMoney(Number(order.valor_estimado))}</td>
                      <td>
                        <span className={purchasingStyles.rowActions}>
                          <button type="button" className={styles.linkBtn} onClick={() => setViewing(order)}>Ver</button>
                          {actions.edit && <button type="button" className={styles.linkBtn} onClick={() => setEditing(order)}>Editar</button>}
                          {actions.approve && <button type="button" className={styles.linkBtn} onClick={() => approve(order)}>Aprobar</button>}
                          {actions.receive && <Link className={styles.textLink} to={`/compras/recepcion?orden=${order.id}`}>Recibir</Link>}
                          {actions.close && <button type="button" className={styles.linkBtn} onClick={() => setReasoning({ order, kind: 'cerrar' })}>Cerrar</button>}
                          {actions.cancel && <button type="button" className={`${styles.linkBtn} ${styles.dangerText}`} onClick={() => setReasoning({ order, kind: 'cancelar' })}>Cancelar</button>}
                        </span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {editing && (
        <OrderForm order={editing === 'new' ? null : editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); load() }} />
      )}
      {viewing && <OrderDetail order={viewing} onClose={() => setViewing(null)} />}
      {reasoning && (
        <ReasonModal
          title={reasoning.kind === 'cancelar' ? `Cancelar la orden ${reasoning.order.codigo}` : `Cerrar la orden ${reasoning.order.codigo}`}
          help={reasoning.kind === 'cancelar'
            ? 'La orden queda cancelada y ya no se puede recibir. Solo se puede cancelar una orden sin recepciones.'
            : 'Cierra la orden con lo recibido hasta ahora: lo pendiente ya no va a llegar.'}
          confirmLabel={reasoning.kind === 'cancelar' ? 'Cancelar orden' : 'Cerrar orden'} onConfirm={confirmReason} onClose={() => setReasoning(null)}
        />
      )}
    </div>
  )
}
