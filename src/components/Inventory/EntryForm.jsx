import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { apiGet, apiRequest } from '../../api/client'
import { useAuth } from '../../auth/session'
import { useToast } from '../ui/toastContext'
import EvidencePicker from './EvidencePicker'
import { uploadEvidence } from './evidence'
import { PRODUCT_TYPES, PURCHASED, fieldErrors, formatDate, formatQty, todayISO } from './labels'
import styles from './Inventory.module.css'

const EMPTY = { producto: '', cantidad: '', fecha: todayISO(), proveedor: '', orden_compra: '', lote: '', orden: '', observaciones: '' }

const byName = (a, b) => a.razon_social.localeCompare(b.razon_social, 'es')

export default function EntryForm({ products, onChanged }) {
  const notify = useToast()
  const { user } = useAuth()
  const [form, setForm] = useState(EMPTY)
  const [files, setFiles] = useState([])
  const [errors, setErrors] = useState({})
  const [saving, setSaving] = useState(false)
  const [suppliers, setSuppliers] = useState([])
  const [suppliersLoaded, setSuppliersLoaded] = useState(false)
  const [orders, setOrders] = useState([])
  const [ordersLoaded, setOrdersLoaded] = useState(false)

  const product = products.find((p) => String(p.id) === String(form.producto))
  const purchased = product && PURCHASED.includes(product.tipo)
  const madeInHouse = product && !purchased
  const order = orders.find((o) => String(o.id) === String(form.orden))

  const set = (field) => (event) => setForm((current) => ({ ...current, [field]: event.target.value }))

  // Las compras se hacen a un proveedor registrado: se elige de la lista, no se escribe.
  useEffect(() => {
    apiGet('/api/inventario/proveedores/')
      .then((data) => setSuppliers(data))
      .catch(() => setSuppliers([]))
      .finally(() => setSuppliersLoaded(true))
  }, [])

  // Un pantalón solo entra cerrando la orden que lo fabricó: se buscan las que siguen abiertas.
  useEffect(() => {
    if (!madeInHouse) return
    let cancelled = false
    apiGet(`/api/inventario/ordenes/?estado=EN_PROCESO&producto_resultado=${product.id}`)
      .then((data) => !cancelled && (setOrders(data), setOrdersLoaded(true)))
      .catch(() => !cancelled && (setOrders([]), setOrdersLoaded(true)))
    return () => {
      cancelled = true
    }
  }, [madeInHouse, product?.id])

  const pickProduct = (event) => {
    setOrders([])
    setOrdersLoaded(false)
    setForm((current) => ({ ...current, producto: event.target.value, orden: '', lote: '', proveedor: '', orden_compra: '' }))
    setErrors({})
  }

  const submit = async (event) => {
    event.preventDefault()
    setSaving(true)
    setErrors({})
    let movement
    try {
      movement = await apiRequest('/api/inventario/ingresos/', {
        method: 'POST',
        body: { ...form, orden: form.orden || null, proveedor: form.proveedor || null },
      })
    } catch (error) {
      setErrors(fieldErrors(error))
      setSaving(false)
      return
    }
    // El ingreso ya quedó guardado; si un adjunto falla se avisa sin repetir el ingreso.
    try {
      await uploadEvidence('movimientos', movement.id, files)
      notify(`Ingreso registrado: ${formatQty(movement.cantidad, movement.unidad)} de ${movement.producto_nombre}.`)
    } catch (error) {
      notify(`Ingreso registrado, pero las evidencias no se subieron: ${error.message}`, 'error')
    }
    setForm({ ...EMPTY, fecha: todayISO() })
    setFiles([])
    setOrders([])
    setOrdersLoaded(false)
    setSaving(false)
    onChanged()
  }

  const err = (name) => errors[name] && <span className={styles.fieldError}>{errors[name]}</span>
  const madeLabel = product?.tipo === 'GENERICO' ? 'orden de producción' : 'orden de lavandería'
  // Primero los proveedores de la categoría del producto; el resto, por si hace falta otro.
  const sameCategory = suppliers.filter((s) => s.categoria === product?.categoria).sort(byName)
  const otherSuppliers = suppliers.filter((s) => s.categoria !== product?.categoria).sort(byName)

  return (
    <>
    <form className={`${styles.card} ${styles.form}`} onSubmit={submit}>
      <h2 className={styles.cardTitle}>Ingreso a inventario</h2>

      <div className={styles.grid}>
        <div className={styles.field}>
          <label htmlFor="ing-producto">Producto</label>
          <div className={styles.inline}>
            <select id="ing-producto" value={form.producto} onChange={pickProduct} required>
              <option value="">Selecciona un producto</option>
              {PRODUCT_TYPES.map((type) => {
                const group = products.filter((p) => p.tipo === type.value)
                return (
                  group.length > 0 && (
                    <optgroup key={type.value} label={type.plural}>
                      {group.map((p) => (
                        <option key={p.id} value={p.id}>{p.nombre}</option>
                      ))}
                    </optgroup>
                  )
                )
              })}
            </select>
          </div>
          <span className={styles.hint}>
            ¿No está en la lista? Créalo en el <Link to="/inventario/catalogo" className={styles.textLink}>Catálogo</Link>.
          </span>
          {err('producto')}
        </div>

        {purchased && (
          <>
            <div className={styles.field}>
              <label htmlFor="ing-proveedor">Proveedor</label>
              <select id="ing-proveedor" value={form.proveedor} onChange={set('proveedor')} required disabled={!suppliersLoaded || suppliers.length === 0}>
                <option value="">
                  {!suppliersLoaded ? 'Cargando proveedores…' : suppliers.length ? 'Selecciona el proveedor' : 'No hay proveedores registrados'}
                </option>
                {sameCategory.length > 0 && (
                  <optgroup label="De esta categoría">
                    {sameCategory.map((s) => (
                      <option key={s.id} value={s.id}>{s.razon_social} · NIT {s.nit_formateado}</option>
                    ))}
                  </optgroup>
                )}
                {otherSuppliers.length > 0 && (
                  <optgroup label={sameCategory.length ? 'Otros proveedores' : 'Proveedores'}>
                    {otherSuppliers.map((s) => (
                      <option key={s.id} value={s.id}>{s.razon_social} · NIT {s.nit_formateado}</option>
                    ))}
                  </optgroup>
                )}
              </select>
              <span className={styles.hint}>
                ¿No aparece? Regístralo en <Link to="/inventario/proveedores" className={styles.textLink}>Proveedores</Link>.
              </span>
              {err('proveedor')}
            </div>
            <label className={styles.field}>
              Orden de compra (opcional)
              <input value={form.orden_compra} onChange={set('orden_compra')} maxLength={40} placeholder="OC-00123" />
              <span className={styles.hint}>Referencia de la compra. Cuando exista el módulo de compras se enlazará.</span>
              {err('orden_compra')}
            </label>
          </>
        )}

        {madeInHouse && (
          <div className={`${styles.field} ${styles.full}`}>
            <label htmlFor="ing-orden">Orden de origen</label>
            <select id="ing-orden" value={form.orden} onChange={set('orden')} required disabled={!ordersLoaded || orders.length === 0}>
              <option value="">
                {!ordersLoaded ? 'Buscando órdenes…' : orders.length ? `Selecciona la ${madeLabel}` : `No hay ${madeLabel} en proceso`}
              </option>
              {orders.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.codigo} · sale {formatDate(o.fecha_salida)} · {o.responsable}
                </option>
              ))}
            </select>
            <span className={styles.hint}>
              {ordersLoaded && orders.length === 0
                ? `Solo entra lo que sale de una orden. Registra primero la salida en la pestaña Salida.`
                : 'Al recibirlo la orden se cierra.'}
            </span>
            {err('orden')}
          </div>
        )}

        {product && (
          <>
            <label className={styles.field}>
              Cantidad ({product.unidad})
              <input
                type="number" min="0" step={['rollo', 'caja', 'unidad'].includes(product.unidad) ? '1' : '0.01'}
                value={form.cantidad} onChange={set('cantidad')} required
              />
              {order?.tipo === 'LAVANDERIA' && (
                <span className={styles.hint}>Se enviaron {formatQty(order.cantidad_prendas, product.unidad)}; no pueden volver más.</span>
              )}
              {err('cantidad')}
            </label>
            <div className={styles.field}>
              Unidad de medida
              <div className={styles.readonly}>{product.unidad}</div>
            </div>
            <label className={styles.field}>
              Fecha de ingreso
              <input type="date" value={form.fecha} max={todayISO()} onChange={set('fecha')} required />
              {err('fecha')}
            </label>
            <div className={styles.field}>
              {purchased ? <label htmlFor="ing-lote">Lote</label> : 'Lote (ficha técnica de la orden)'}
              {purchased ? (
                <input id="ing-lote" value={form.lote} onChange={set('lote')} maxLength={60} required placeholder="L-2026-01" />
              ) : (
                <div className={styles.readonly}>{order ? order.ficha_tecnica : 'Se toma de la orden'}</div>
              )}
              {err('lote')}
            </div>
          </>
        )}

        <label className={`${styles.field} ${styles.full}`}>
          Observaciones
          <textarea value={form.observaciones} onChange={set('observaciones')} maxLength={1000} />
        </label>

        <div className={styles.full}>
          <EvidencePicker files={files} onChange={setFiles} />
        </div>
      </div>

      {errors.detail && <p className={styles.formError}>{errors.detail}</p>}
      <p className={styles.muted}>Registra: {user.first_name || user.full_name} (queda en el historial).</p>
      <div className={styles.actions}>
        <button
          type="button" className={styles.secondaryBtn}
          onClick={() => { setForm({ ...EMPTY, fecha: todayISO() }); setFiles([]); setErrors({}) }}
        >
          Limpiar
        </button>
        <button type="submit" className={styles.primaryBtn} disabled={saving || !product}>
          {saving ? 'Guardando…' : 'Guardar ingreso'}
        </button>
      </div>
    </form>

    </>
  )
}
