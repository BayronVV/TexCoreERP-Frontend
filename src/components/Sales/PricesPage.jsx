import { useCallback, useEffect, useState } from 'react'
import { apiGet, apiRequest } from '../../api/client'
import { useAuth } from '../../auth/session'
import { useToast } from '../ui/toastContext'
import Modal from '../ui/Modal'
import { fieldErrors } from '../Inventory/labels'
import styles from '../Inventory/Inventory.module.css'
import { marginLabel, money } from './sales'

/**
 * Edición de los precios de una referencia: costo de fábrica (el piso de toda venta) y precios mayorista y detal, antes de IVA.
 * Usa `PUT /api/ventas/precios/:referencia/`.
 * @param {object} props
 * @param {object} props.item Fila de precios de la referencia.
 * @param {function()} props.onSaved Se llama al guardar.
 * @param {function()} props.onClose Cierra el formulario.
 */
function PriceForm({ item, onSaved, onClose }) {
  const notify = useToast()
  const [form, setForm] = useState({
    costo_fabrica: item.costo_fabrica ?? '', precio_mayorista: item.precio_mayorista ?? '', precio_detal: item.precio_detal ?? '',
  })
  const [errors, setErrors] = useState({})
  const [saving, setSaving] = useState(false)
  const set = (name) => (event) => setForm((current) => ({ ...current, [name]: event.target.value }))
  const err = (name) => errors[name] && <span className={styles.fieldError}>{errors[name]}</span>

  const submit = async (event) => {
    event.preventDefault()
    setSaving(true)
    setErrors({})
    const body = Object.fromEntries(Object.entries(form).map(([key, value]) => [key, /^\d+$/.test(String(value).trim()) ? Number(value) : value]))
    try {
      await apiRequest(`/api/ventas/precios/${item.referencia}/`, { method: 'PUT', body })
      notify(`Precios de ${item.codigo} guardados.`)
      onSaved()
    } catch (error) {
      setErrors(fieldErrors(error))
      setSaving(false)
    }
  }

  return (
    <Modal title={`Precios de ${item.codigo} · ${item.nombre}`} onClose={onClose}>
      <form className={styles.form} onSubmit={submit} noValidate>
        <p className={styles.muted}>En pesos enteros y antes de IVA. El precio mayorista no puede ser menor al costo de fábrica ni el de detal menor al mayorista.</p>
        <label className={styles.field}>
          Costo de fábrica (el piso de venta)
          <input value={form.costo_fabrica} onChange={set('costo_fabrica')} inputMode="numeric" />
          {err('costo_fabrica')}
        </label>
        <label className={styles.field}>
          Precio mayorista
          <input value={form.precio_mayorista} onChange={set('precio_mayorista')} inputMode="numeric" />
          {err('precio_mayorista')}
        </label>
        <label className={styles.field}>
          Precio detal
          <input value={form.precio_detal} onChange={set('precio_detal')} inputMode="numeric" />
          {err('precio_detal')}
        </label>
        {errors.detail && <p className={styles.formError}>{errors.detail}</p>}
        <div className={styles.actions}>
          <button type="button" className={styles.secondaryBtn} onClick={onClose}>Cancelar</button>
          <button type="submit" className={styles.primaryBtn} disabled={saving}>{saving ? 'Guardando…' : 'Guardar'}</button>
        </div>
      </form>
    </Modal>
  )
}

/**
 * Ventas · Precios, ruta `/ventas/precios` (`ventas.ver`): costo de fábrica y precios de venta por referencia. Solo `ventas.precios`
 * (Gerente y Administrador) los modifica. Una referencia sin precio no se puede vender. Lee `GET /api/ventas/precios/`.
 */
export default function PricesPage() {
  const { can } = useAuth()
  const canEdit = can('ventas.precios')
  const [rows, setRows] = useState(null)
  const [search, setSearch] = useState('')
  const [loadError, setLoadError] = useState('')
  const [editing, setEditing] = useState(null)

  const load = useCallback(() => {
    const params = new URLSearchParams()
    if (search.trim()) params.set('q', search.trim())
    apiGet(`/api/ventas/precios/?${params}`).then((data) => (setRows(data), setLoadError(''))).catch((error) => setLoadError(error.message))
  }, [search])

  useEffect(() => {
    const timer = setTimeout(load, 250)
    return () => clearTimeout(timer)
  }, [load])

  return (
    <div className={styles.page}>
      <header className={styles.pageHeader}>
        <p className={styles.eyebrow}>Ventas y despachos</p>
        <h1>Precios de venta</h1>
        <p className={styles.subtitle}>
          Costo de fábrica y precios por referencia, en pesos y antes de IVA. Ninguna venta, ni con descuento, puede quedar por debajo del costo de fábrica.
        </p>
      </header>

      <section className={styles.card}>
        <div className={styles.filters}>
          <input type="search" placeholder="Buscar referencia" value={search} onChange={(event) => setSearch(event.target.value)} aria-label="Buscar referencias" />
        </div>
        {loadError && <p className={styles.formError}>{loadError}</p>}
        {rows && rows.length === 0 && <p className={styles.empty}>No hay referencias activas para mostrar.</p>}
        {rows && rows.length > 0 && (
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Referencia</th><th className={styles.num}>Costo de fábrica</th><th className={styles.num}>Mayorista</th><th className={styles.num}>Margen</th>
                  <th className={styles.num}>Detal</th><th className={styles.num}>Margen</th><th />
                </tr>
              </thead>
              <tbody>
                {rows.map((item) => (
                  <tr key={item.referencia}>
                    <td><strong>{item.codigo}</strong> · {item.nombre}</td>
                    <td className={styles.num}>{item.costo_fabrica == null ? '—' : money(item.costo_fabrica)}</td>
                    <td className={styles.num}>{item.precio_mayorista == null ? 'Sin precio' : money(item.precio_mayorista)}</td>
                    <td className={styles.num}>{marginLabel(item.precio_mayorista, item.costo_fabrica)}</td>
                    <td className={styles.num}>{item.precio_detal == null ? 'Sin precio' : money(item.precio_detal)}</td>
                    <td className={styles.num}>{marginLabel(item.precio_detal, item.costo_fabrica)}</td>
                    <td>{canEdit && <button type="button" className={styles.linkBtn} onClick={() => setEditing(item)}>{item.costo_fabrica == null ? 'Registrar' : 'Editar'}</button>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {editing && <PriceForm item={editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); load() }} />}
    </div>
  )
}
