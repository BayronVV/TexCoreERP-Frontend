import { useState } from 'react'
import { apiRequest } from '../../api/client'
import { useToast } from '../ui/toastContext'
import Modal from '../ui/Modal'
import { PRODUCT_TYPES, UNITS, fieldErrors } from './labels'
import styles from './Inventory.module.css'

// Crea un producto (o edita nombre y mínimo de uno existente). Tipo y unidad no
// se cambian después: los movimientos ya registrados dependen de ellos.
export default function ProductModal({ product, allowedTypes, defaultType, onSaved, onClose }) {
  const notify = useToast()
  const editing = Boolean(product)
  const types = PRODUCT_TYPES.filter((t) => !allowedTypes || allowedTypes.includes(t.value))
  const [form, setForm] = useState({
    nombre: product?.nombre ?? '',
    tipo: product?.tipo ?? defaultType ?? types[0].value,
    unidad: product?.unidad ?? (defaultType === 'GENERICO' || defaultType === 'TERMINADO' ? 'unidad' : 'm'),
    stock_minimo: product?.stock_minimo ?? '0',
    descripcion: product?.descripcion ?? '',
  })
  const [errors, setErrors] = useState({})
  const [saving, setSaving] = useState(false)

  const set = (field) => (event) => setForm((current) => ({ ...current, [field]: event.target.value }))
  const setType = (event) => {
    const tipo = event.target.value
    const made = tipo === 'GENERICO' || tipo === 'TERMINADO'
    setForm((current) => ({ ...current, tipo, unidad: made ? 'unidad' : current.unidad }))
  }

  const submit = async (event) => {
    event.preventDefault()
    setSaving(true)
    setErrors({})
    try {
      const saved = editing
        ? await apiRequest(`/api/inventario/productos/${product.id}/`, {
            method: 'PATCH',
            body: { nombre: form.nombre, stock_minimo: form.stock_minimo || '0', descripcion: form.descripcion },
          })
        : await apiRequest('/api/inventario/productos/', {
            method: 'POST',
            body: { ...form, stock_minimo: form.stock_minimo || '0' },
          })
      notify(editing ? 'Producto actualizado.' : `Producto ${saved.codigo} creado.`)
      onSaved(saved)
    } catch (error) {
      setErrors(fieldErrors(error))
    } finally {
      setSaving(false)
    }
  }

  const err = (name) => errors[name] && <span className={styles.fieldError}>{errors[name]}</span>

  return (
    <Modal title={editing ? `Editar ${product.codigo}` : 'Nuevo producto'} onClose={onClose}>
      <form className={styles.form} onSubmit={submit}>
        <label className={styles.field}>
          Nombre
          <input value={form.nombre} onChange={set('nombre')} maxLength={150} required placeholder="Ej. Tela denim 12 oz" />
          {err('nombre')}
        </label>
        <div className={styles.grid}>
          <label className={styles.field}>
            Tipo
            <select value={form.tipo} onChange={setType} disabled={editing}>
              {types.map((t) => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
            {err('tipo')}
          </label>
          <label className={styles.field}>
            Unidad de medida
            <select value={form.unidad} onChange={set('unidad')} disabled={editing}>
              {UNITS.map((u) => (
                <option key={u.value} value={u.value}>{u.label}</option>
              ))}
            </select>
            {err('unidad')}
          </label>
        </div>
        <label className={styles.field}>
          Stock mínimo
          <input type="number" min="0" step="0.01" value={form.stock_minimo} onChange={set('stock_minimo')} />
          <span className={styles.hint}>Al llegar a esta cantidad aparece la alerta. Con 0 no se generan alertas.</span>
          {err('stock_minimo')}
        </label>
        <label className={styles.field}>
          Descripción (opcional)
          <input value={form.descripcion} onChange={set('descripcion')} maxLength={255} />
        </label>
        {errors.detail && <p className={styles.formError}>{errors.detail}</p>}
        <div className={styles.actions}>
          <button type="button" className={styles.secondaryBtn} onClick={onClose}>Cancelar</button>
          <button type="submit" className={styles.primaryBtn} disabled={saving}>
            {saving ? 'Guardando…' : editing ? 'Guardar cambios' : 'Crear producto'}
          </button>
        </div>
      </form>
    </Modal>
  )
}
