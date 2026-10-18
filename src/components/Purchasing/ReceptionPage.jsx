import { useCallback, useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { apiGet, apiRequest } from '../../api/client'
import { useAuth } from '../../auth/session'
import { fieldErrors, formatDate, formatQty, todayISO } from '../Inventory/labels'
import styles from '../Inventory/Inventory.module.css'
import purchasingStyles from './Purchasing.module.css'
import { hasQuantity, looseRow, purchasableProducts, receiptBody, receiptProblems, receiptRowProblem, receiptRowsFor } from './purchasing'

// Recepción de mercancía en el almacén: varios productos en una sola entrega, contra una orden de compra aprobada o suelta.
// Todo se guarda de una vez: si una fila falla, el servidor no registra ninguna.
export default function ReceptionPage() {
  const { can } = useAuth()
  const [params] = useSearchParams()
  const canReceive = can('inventario.gestionar')
  const [withOrder, setWithOrder] = useState(true)
  const [orders, setOrders] = useState([])
  const [orderId, setOrderId] = useState(params.get('orden') ?? '')
  const [order, setOrder] = useState(null)
  const [rows, setRows] = useState([])
  const [suppliers, setSuppliers] = useState([])
  const [products, setProducts] = useState([])
  const [supplier, setSupplier] = useState('')
  const [pick, setPick] = useState('')
  const [documento, setDocumento] = useState('')
  const [fecha, setFecha] = useState(todayISO())
  const [observaciones, setObservaciones] = useState('')
  const [errors, setErrors] = useState({})
  const [saving, setSaving] = useState(false)
  const [done, setDone] = useState(null)
  const [attempted, setAttempted] = useState(false) // tras un intento de registrar se marcan todas las filas con problema
  const [recent, setRecent] = useState([])
  const [loadError, setLoadError] = useState('')

  const loadOrders = useCallback(() => {
    apiGet('/api/compras/ordenes/?limit=200')
      .then((list) => setOrders(list.filter((item) => item.recibible)))
      .catch((error) => setLoadError(error.message))
    apiGet('/api/compras/recepciones/?limit=15').then(setRecent).catch(() => {})
  }, [])

  useEffect(() => {
    loadOrders()
    Promise.all([apiGet('/api/inventario/proveedores/'), apiGet('/api/inventario/productos/')])
      .then(([supplierList, productList]) => (setSuppliers(supplierList), setProducts(purchasableProducts(productList))))
      .catch(() => {})
  }, [loadOrders])

  // La orden elegida (también la que llega por `?orden=`): se trae completa para mostrar lo pedido, lo recibido y lo pendiente.
  useEffect(() => {
    if (!withOrder || !orderId) return
    apiGet(`/api/compras/ordenes/${orderId}/`)
      .then((data) => (setOrder(data), setRows(receiptRowsFor(data)), setErrors({})))
      .catch((error) => setLoadError(error.message))
  }, [withOrder, orderId])

  const switchMode = (next) => {
    setWithOrder(next)
    setErrors({})
    setDone(null)
    setRows(next ? (order ? receiptRowsFor(order) : []) : [])
  }

  const changeOrder = (id) => {
    setOrderId(id)
    setDone(null)
    if (!id) {
      setOrder(null)
      setRows([])
    }
  }

  const setRow = (index, field, value) =>
    setRows((current) => current.map((row, i) => (i === index ? { ...row, [field]: value, tocada: true } : row)))

  const productById = useMemo(() => new Map(products.map((product) => [String(product.id), product])), [products])
  const addLoose = () => {
    const product = productById.get(pick)
    if (!product || rows.some((row) => row.producto === product.id)) return
    setRows([...rows, looseRow(product)])
    setPick('')
  }

  const activeOrder = withOrder ? order : null
  const problems = receiptProblems({ rows, documento, supplier, withOrder })
  const reset = () => {
    setRows([])
    setDocumento('')
    setObservaciones('')
    setFecha(todayISO())
    setOrderId('')
    setOrder(null)
    setSupplier('')
  }

  const submit = async (event) => {
    event.preventDefault()
    if (withOrder && !activeOrder) return setErrors({ orden: 'Elige la orden de compra.' })
    if (problems.length) return (setAttempted(true), setErrors({ detail: problems[0] }))
    setSaving(true)
    setErrors({})
    try {
      const receipt = await apiRequest('/api/compras/recepciones/', {
        method: 'POST', body: receiptBody({ order: activeOrder, supplier, rows, documento, fecha, observaciones }),
      })
      setDone(receipt)
      setAttempted(false)
      reset()
      loadOrders()
    } catch (error) {
      setErrors(fieldErrors(error))
    } finally {
      setSaving(false)
    }
  }

  const err = (name) => errors[name] && <span className={styles.fieldError}>{errors[name]}</span>
  const ready = withOrder ? Boolean(activeOrder) : Boolean(supplier)

  return (
    <div className={styles.page}>
      <header className={styles.pageHeader}>
        <p className={styles.eyebrow}>Compras</p>
        <h1>Recepción de mercancía</h1>
        <p className={styles.subtitle}>
          Registra lo que llegó al almacén, con varios productos a la vez. Cada producto entra como una compra: suma al stock, actualiza el costo promedio y deja su fila en el Kardex.
        </p>
      </header>

      {done && (
        <p className={purchasingStyles.success} role="status">
          Recepción {done.codigo} registrada{done.orden_codigo ? ` contra la orden ${done.orden_codigo} (${done.orden_estado === 'RECIBIDA' ? 'recibida completa' : 'recibida parcial'})` : ''}.
        </p>
      )}
      {loadError && <p className={styles.formError}>{loadError}</p>}

      {!canReceive ? (
        <section className={styles.card}><p className={styles.muted}>Tu rol puede consultar las recepciones pero no registrarlas: eso lo hace el almacenista.</p></section>
      ) : (
        <form className={styles.card} onSubmit={submit} noValidate>
          <div className={purchasingStyles.modeSwitch} role="radiogroup" aria-label="Tipo de recepción">
            <label className={withOrder ? purchasingStyles.modeActive : ''}>
              <input type="radio" name="mode" checked={withOrder} onChange={() => switchMode(true)} /> Contra una orden de compra
            </label>
            <label className={withOrder ? '' : purchasingStyles.modeActive}>
              <input type="radio" name="mode" checked={!withOrder} onChange={() => switchMode(false)} /> Sin orden de compra
            </label>
          </div>

          <div className={styles.grid}>
            {withOrder ? (
              <label className={`${styles.field} ${styles.full}`}>
                Orden de compra aprobada
                <select value={orderId} onChange={(event) => changeOrder(event.target.value)}>
                  <option value="">Selecciona</option>
                  {orders.map((item) => <option key={item.id} value={item.id}>{item.codigo} · {item.proveedor_nombre} · {item.estado_nombre}</option>)}
                </select>
                {orders.length === 0 && <span className={styles.hint}>No hay órdenes aprobadas esperando mercancía.</span>}
                {err('orden')}
              </label>
            ) : (
              <label className={`${styles.field} ${styles.full}`}>
                Proveedor
                <select value={supplier} onChange={(event) => setSupplier(event.target.value)}>
                  <option value="">Selecciona</option>
                  {suppliers.map((item) => <option key={item.id} value={item.id}>{item.razon_social}</option>)}
                </select>
                {err('proveedor')}
              </label>
            )}
            <label className={styles.field}>
              Remisión o factura del proveedor
              <input value={documento} onChange={(event) => setDocumento(event.target.value)} maxLength={40} placeholder="Ej. REM-10458" />
              {err('documento')}
            </label>
            <label className={styles.field}>
              Fecha de recepción
              <input type="date" value={fecha} max={todayISO()} onChange={(event) => setFecha(event.target.value)} />
              {err('fecha')}
            </label>
            <label className={`${styles.field} ${styles.full}`}>
              Observaciones (opcional)
              <input value={observaciones} onChange={(event) => setObservaciones(event.target.value)} maxLength={500} />
            </label>
          </div>

          {ready && !withOrder && (
            <div className={purchasingStyles.pickRow}>
              <label className={styles.field}>
                Agregar producto
                <select value={pick} onChange={(event) => setPick(event.target.value)}>
                  <option value="">Selecciona</option>
                  {products.filter((product) => !rows.some((row) => row.producto === product.id)).map((product) => (
                    <option key={product.id} value={product.id}>{product.codigo} · {product.nombre} ({product.unidad})</option>
                  ))}
                </select>
              </label>
              <button type="button" className={styles.secondaryBtn} onClick={addLoose}>+ Agregar</button>
            </div>
          )}

          {ready && rows.length === 0 && (
            <p className={styles.empty}>{withOrder ? 'Esta orden ya no tiene nada pendiente por recibir.' : 'Agrega los productos que llegaron.'}</p>
          )}
          {rows.length > 0 && (
            <div className={styles.tableWrap}>
              <table className={`${styles.table} ${purchasingStyles.receiptTable}`}>
                <thead>
                  <tr>
                    <th>Producto</th>
                    {withOrder && <th className={styles.num}>Pendiente</th>}
                    <th>Cantidad que llegó</th><th>Lote</th><th>Costo real por unidad</th>{!withOrder && <th />}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row, index) => {
                    const problem = row.tocada || attempted ? receiptRowProblem(row) : ''
                    return (
                      <tr key={row.linea ?? row.producto} className={problem ? purchasingStyles.rowInvalid : ''}>
                        <td>{row.nombre}<span className={styles.muted}> ({row.unidad})</span></td>
                        {withOrder && <td className={styles.num}>{formatQty(row.pendiente, row.unidad)}</td>}
                        <td>
                          <input value={row.cantidad} inputMode="decimal" aria-label={`Cantidad de ${row.nombre}`} onChange={(event) => setRow(index, 'cantidad', event.target.value)} />
                          {problem && <span className={purchasingStyles.rowError}>{problem}</span>}
                        </td>
                        <td><input value={row.lote} maxLength={60} aria-label={`Lote de ${row.nombre}`} disabled={!hasQuantity(row)} onChange={(event) => setRow(index, 'lote', event.target.value)} /></td>
                        <td><input value={row.costo} inputMode="decimal" aria-label={`Costo de ${row.nombre}`} placeholder="Opcional" disabled={!hasQuantity(row)} onChange={(event) => setRow(index, 'costo', event.target.value)} /></td>
                        {!withOrder && <td><button type="button" className={`${styles.linkBtn} ${styles.dangerText}`} onClick={() => setRows(rows.filter((_, i) => i !== index))}>Quitar</button></td>}
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
          {withOrder && rows.length > 0 && (
            <p className={purchasingStyles.note}>Se puede recibir hasta un 5 % más de lo pendiente. Deja en blanco o en cero lo que no llegó.</p>
          )}
          {err('lineas')}
          {errors.detail && <p className={styles.formError}>{errors.detail}</p>}

          <div className={styles.actions}>
            <button type="submit" className={styles.primaryBtn} disabled={saving || !ready}>
              {saving ? 'Registrando…' : 'Registrar recepción'}
            </button>
          </div>
        </form>
      )}

      <section className={styles.card}>
        <p className={styles.subhead}>Últimas recepciones</p>
        {recent.length === 0 ? (
          <p className={styles.muted}>Todavía no hay recepciones registradas.</p>
        ) : (
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead><tr><th>Código</th><th>Fecha</th><th>Orden</th><th>Proveedor</th><th>Documento</th><th className={styles.num}>Productos</th><th>Recibió</th></tr></thead>
              <tbody>
                {recent.map((receipt) => (
                  <tr key={receipt.id}>
                    <td><strong>{receipt.codigo}</strong></td>
                    <td>{formatDate(receipt.fecha)}</td>
                    <td>{receipt.orden_codigo ?? 'Sin orden'}</td>
                    <td>{receipt.proveedor_nombre}</td>
                    <td>{receipt.documento}</td>
                    <td className={styles.num}>{receipt.lineas.length}</td>
                    <td>{receipt.recibido_por_nombre}</td>
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
