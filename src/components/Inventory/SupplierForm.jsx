import { useState } from 'react'
import { apiRequest } from '../../api/client'
import { useToast } from '../ui/toastContext'
import Modal from '../ui/Modal'
import { fieldErrors } from './labels'
import styles from './Inventory.module.css'

const EMPTY = {
  nit: '', categoria: '', razon_social: '', contacto: '', telefono: '', correo: '', ciudad: '', direccion: '',
}

// RF04: registrar y actualizar proveedores, clasificados por lo que suministran.
export default function SupplierForm({ supplier, categories, onSaved, onClose }) {
  const notify = useToast()
  const editing = Boolean(supplier)
  const [form, setForm] = useState(
    editing
      ? {
          // Se muestra el NIT completo (con puntos y dígito de verificación), como se escribe en facturas.
          nit: supplier.nit_formateado, categoria: supplier.categoria, razon_social: supplier.razon_social,
          contacto: supplier.contacto, telefono: supplier.telefono, correo: supplier.correo,
          ciudad: supplier.ciudad, direccion: supplier.direccion,
        }
      : EMPTY,
  )
  const [errors, setErrors] = useState({})
  const [saving, setSaving] = useState(false)
  const set = (field) => (event) => setForm((current) => ({ ...current, [field]: event.target.value }))

  const submit = async (event) => {
    event.preventDefault()
    setSaving(true)
    setErrors({})
    try {
      const saved = await apiRequest(editing ? `/api/inventario/proveedores/${supplier.id}/` : '/api/inventario/proveedores/', {
        method: editing ? 'PATCH' : 'POST',
        body: form,
      })
      notify(editing ? 'Proveedor actualizado.' : 'Proveedor registrado con éxito.')
      onSaved(saved)
    } catch (error) {
      setErrors(fieldErrors(error))
      setSaving(false)
    }
  }

  const err = (name) => errors[name] && <span className={styles.fieldError}>{errors[name]}</span>

  return (
    <Modal title={editing ? 'Editar proveedor' : 'Registrar nuevo proveedor'} onClose={onClose} wide>
      <form className={styles.form} onSubmit={submit}>
        <div className={styles.grid}>
          <label className={styles.field}>
            NIT / identificación
            <input
              value={form.nit} onChange={set('nit')} required maxLength={20} inputMode="numeric"
              placeholder="Ej. 900.123.456-1"
            />
            <span className={styles.hint}>Debe ser único. Con o sin puntos y dígito de verificación.</span>
            {err('nit')}
          </label>
          <label className={styles.field}>
            Tipo de insumo que suministra
            <select value={form.categoria} onChange={set('categoria')} required>
              <option value="">Selecciona</option>
              {categories.map((c) => (
                <option key={c.codigo} value={c.codigo}>{c.nombre}</option>
              ))}
            </select>
            {err('categoria')}
          </label>
          <label className={`${styles.field} ${styles.full}`}>
            Razón social / empresa
            <input value={form.razon_social} onChange={set('razon_social')} required maxLength={150} placeholder="Ej. Fabricato Textil S.A." />
            {err('razon_social')}
          </label>
          <label className={styles.field}>
            Contacto comercial (opcional)
            <input value={form.contacto} onChange={set('contacto')} maxLength={120} placeholder="Ej. Carlos Rivera" />
            {err('contacto')}
          </label>
          <label className={styles.field}>
            Teléfono
            <input value={form.telefono} onChange={set('telefono')} maxLength={20} inputMode="tel" placeholder="Ej. 312 456 7890" />
            {err('telefono')}
          </label>
          <label className={styles.field}>
            Correo electrónico (opcional)
            <input type="email" value={form.correo} onChange={set('correo')} maxLength={120} placeholder="ventas@proveedor.com" />
            {err('correo')}
          </label>
          <label className={styles.field}>
            Ciudad (opcional)
            <input value={form.ciudad} onChange={set('ciudad')} maxLength={80} />
            {err('ciudad')}
          </label>
          <label className={`${styles.field} ${styles.full}`}>
            Dirección física (opcional)
            <input value={form.direccion} onChange={set('direccion')} maxLength={200} placeholder="Ej. Calle 10 # 4-50 Zona Industrial" />
            {err('direccion')}
          </label>
        </div>
        {errors.detail && <p className={styles.formError}>{errors.detail}</p>}
        <div className={styles.actions}>
          <button type="button" className={styles.secondaryBtn} onClick={onClose}>Cancelar</button>
          <button type="submit" className={styles.primaryBtn} disabled={saving}>
            {saving ? 'Guardando…' : editing ? 'Guardar cambios' : 'Registrar proveedor'}
          </button>
        </div>
      </form>
    </Modal>
  )
}
