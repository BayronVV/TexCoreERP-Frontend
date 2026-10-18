import { useEffect, useMemo, useState } from 'react'
import { apiGet, apiRequest } from '../../api/client'
import { useToast } from '../ui/toastContext'
import Modal from '../ui/Modal'
import { fieldErrors, formatQty } from '../Inventory/labels'
import { formatMoney } from '../Inventory/money'
import styles from '../Inventory/Inventory.module.css'
import purchasingStyles from './Purchasing.module.css'
import {
  addLine, emptyOrderForm, lineValue, orderBody, orderForm, orderLinesOf, orderProblems, orderValue, purchasableProducts, removeLine,
} from './purchasing'

// Crear o editar (mientras es borrador) una orden de compra de materia prima o insumos. El precio pactado es opcional; el
// costo real se escribe al recibir la mercancía.
export default function OrderForm({ order, onSaved, onClose }) {
  const notify = useToast()
  const editing = Boolean(order)
  const [form, setForm] = useState(editing ? orderForm(order) : emptyOrderForm())
  const [lines, setLines] = useState(editing ? orderLinesOf(order) : [])
  const [suppliers, setSuppliers] = useState([])
  const [products, setProducts] = useState([])
  const [pick, setPick] = useState({ producto: '', cantidad: '', precio: '' })
  const [pickError, setPickError] = useState('')
  const [errors, setErrors] = useState({})
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    Promise.all([apiGet('/api/inventario/proveedores/'), apiGet('/api/inventario/productos/')])
      .then(([supplierList, productList]) => {
        setSuppliers(supplierList)
        setProducts(purchasableProducts(productList))
      })
      .catch((error) => setErrors({ detail: error.message }))
  }, [])

  const byId = useMemo(() => new Map(products.map((product) => [String(product.id), product])), [products])
  const picked = byId.get(pick.producto)
  const value = orderValue(lines)
  const problems = orderProblems(form, lines)
  const set = (field) => (event) => setForm((current) => ({ ...current, [field]: event.target.value }))

  const add = () => {
    const result = addLine(lines, picked, pick.cantidad, pick.precio)
    if (result.error) return setPickError(result.error)
    setLines(result.lines)
    setPick({ producto: '', cantidad: '', precio: '' })
    setPickError('')
  }

  const submit = async (event) => {
    event.preventDefault()
    if (problems.length) return setErrors({ detail: problems[0] })
    setSaving(true)
    setErrors({})
    try {
      const saved = await apiRequest(editing ? `/api/compras/ordenes/${order.id}/` : '/api/compras/ordenes/', {
        method: editing ? 'PATCH' : 'POST', body: orderBody(form, lines),
      })
      notify(editing ? `Orden ${saved.codigo} actualizada.` : `Orden ${saved.codigo} creada en borrador.`)
      onSaved(saved)
    } catch (error) {
      setErrors(fieldErrors(error))
      setSaving(false)
    }
  }

  const err = (name) => errors[name] && <span className={styles.fieldError}>{errors[name]}</span>

  return (
    <Modal title={editing ? `Editar orden ${order.codigo}` : 'Nueva orden de compra'} onClose={onClose} wide>
      <form className={styles.form} onSubmit={submit} noValidate>
        <div className={styles.grid}>
          <label className={styles.field}>
            Proveedor
            <select value={form.proveedor} onChange={set('proveedor')} required>
              <option value="">Selecciona</option>
              {suppliers.map((supplier) => <option key={supplier.id} value={supplier.id}>{supplier.razon_social}</option>)}
            </select>
            {err('proveedor')}
          </label>
          <label className={styles.field}>
            Fecha esperada (opcional)
            <input type="date" value={form.fecha_esperada} onChange={set('fecha_esperada')} />
            {err('fecha_esperada')}
          </label>
          <label className={styles.field}>
            Condiciones de pago (opcional)
            <input value={form.condiciones_pago} onChange={set('condiciones_pago')} maxLength={120} placeholder="Ej. 30 días" />
            {err('condiciones_pago')}
          </label>
          <label className={styles.field}>
            Notas (opcional)
            <input value={form.notas} onChange={set('notas')} maxLength={500} />
            {err('notas')}
          </label>
        </div>

        <p className={styles.subhead}>Materiales</p>
        <div className={purchasingStyles.pickRow}>
          <label className={styles.field}>
            Material o insumo
            <select value={pick.producto} onChange={(event) => setPick({ ...pick, producto: event.target.value })}>
              <option value="">Selecciona</option>
              {products.filter((product) => !lines.some((line) => line.producto === product.id)).map((product) => (
                <option key={product.id} value={product.id}>{product.codigo} · {product.nombre} ({product.unidad})</option>
              ))}
            </select>
          </label>
          <label className={styles.field}>
            Cantidad{picked ? ` (${picked.unidad})` : ''}
            <input
              value={pick.cantidad} onChange={(event) => setPick({ ...pick, cantidad: event.target.value })} inputMode="decimal"
              placeholder={picked && ['rollo', 'caja', 'unidad'].includes(picked.unidad) ? 'Entero' : '0.00'}
            />
          </label>
          <label className={styles.field}>
            Precio pactado (opcional)
            <input value={pick.precio} onChange={(event) => setPick({ ...pick, precio: event.target.value })} inputMode="decimal" placeholder="Por unidad" />
          </label>
          <button type="button" className={styles.secondaryBtn} onClick={add}>+ Agregar</button>
        </div>
        {pickError && <span className={styles.fieldError} role="alert">{pickError}</span>}
        {err('lineas')}

        {lines.length === 0 ? (
          <p className={styles.empty}>Todavía no hay materiales en la orden.</p>
        ) : (
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead><tr><th>Material</th><th className={styles.num}>Cantidad</th><th className={styles.num}>Precio pactado</th><th className={styles.num}>Valor</th><th /></tr></thead>
              <tbody>
                {lines.map((line) => {
                  const lineTotal = lineValue(line)
                  return (
                    <tr key={line.producto}>
                      <td>{line.nombre}</td>
                      <td className={styles.num}>{formatQty(line.cantidad, line.unidad)}</td>
                      <td className={styles.num}>{line.precio ? formatMoney(Number(line.precio)) : '—'}</td>
                      <td className={styles.num}>{lineTotal === null ? '—' : formatMoney(lineTotal)}</td>
                      <td><button type="button" className={`${styles.linkBtn} ${styles.dangerText}`} onClick={() => setLines(removeLine(lines, line.producto))}>Quitar</button></td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
        <div className={purchasingStyles.totalBar}>
          <span>Valor estimado: {formatMoney(value.total)}</span>
          {value.withoutPrice > 0 && <span className={styles.muted}>{value.withoutPrice} línea(s) sin precio no suman</span>}
        </div>

        {errors.detail && <p className={styles.formError}>{errors.detail}</p>}
        {errors.orden && <p className={styles.formError}>{errors.orden}</p>}
        <div className={styles.actions}>
          <button type="button" className={styles.secondaryBtn} onClick={onClose}>Cancelar</button>
          <button type="submit" className={styles.primaryBtn} disabled={saving || problems.length > 0} title={problems[0] ?? ''}>
            {saving ? 'Guardando…' : editing ? 'Guardar cambios' : 'Crear orden'}
          </button>
        </div>
      </form>
    </Modal>
  )
}
