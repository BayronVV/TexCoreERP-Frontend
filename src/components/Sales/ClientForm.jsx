import { useState } from 'react'
import { apiRequest } from '../../api/client'
import { useToast } from '../ui/toastContext'
import Modal from '../ui/Modal'
import { fieldErrors } from '../Inventory/labels'
import styles from '../Inventory/Inventory.module.css'

const EMPTY = { tipo_documento: 'NIT', documento: '', dv: '', nombre: '', tipo: 'DETAL', ciudad: '', direccion: '', telefono: '', correo: '' }

/**
 * Formulario (en modal) para crear o modificar un cliente. El tipo decide el precio de lista y el descuento máximo; el código lo asigna el sistema.
 * Usa `POST /api/ventas/clientes/` o `PATCH /api/ventas/clientes/:id/`.
 * @param {object} props
 * @param {object} [props.client] Cliente a modificar; sin él, crea uno nuevo.
 * @param {object} props.meta Metadatos de `/api/ventas/metadatos/` (tipos de documento y de cliente).
 * @param {function(object)} props.onSaved Recibe el cliente guardado.
 * @param {function()} props.onClose Cierra el formulario.
 */
export default function ClientForm({ client, meta, onSaved, onClose }) {
  const notify = useToast()
  const [form, setForm] = useState(() => (client ? { ...EMPTY, ...client } : EMPTY))
  const [errors, setErrors] = useState({})
  const [saving, setSaving] = useState(false)
  const set = (name) => (event) => setForm((current) => ({ ...current, [name]: event.target.value }))
  const err = (name) => errors[name] && <span className={styles.fieldError}>{errors[name]}</span>

  const submit = async (event) => {
    event.preventDefault()
    setSaving(true)
    setErrors({})
    const body = { ...form, dv: form.tipo_documento === 'NIT' ? form.dv : '' }
    try {
      const saved = client
        ? await apiRequest(`/api/ventas/clientes/${client.id}/`, { method: 'PATCH', body })
        : await apiRequest('/api/ventas/clientes/', { method: 'POST', body })
      notify(client ? 'Cliente actualizado.' : `Cliente ${saved.codigo} registrado.`)
      onSaved(saved)
    } catch (error) {
      setErrors(fieldErrors(error))
      setSaving(false)
    }
  }

  const types = meta?.tipos_cliente ?? []
  const selected = types.find((item) => item.codigo === form.tipo)

  return (
    <Modal title={client ? `Cliente ${client.codigo}` : 'Nuevo cliente'} onClose={onClose} wide>
      <form className={styles.form} onSubmit={submit} noValidate>
        <div className={styles.grid}>
          <label className={styles.field}>
            Tipo de documento
            <select value={form.tipo_documento} onChange={set('tipo_documento')}>
              {(meta?.tipos_documento ?? []).map((item) => <option key={item.codigo} value={item.codigo}>{item.nombre}</option>)}
            </select>
          </label>
          <label className={styles.field}>
            Documento (solo números)
            <input value={form.documento} onChange={set('documento')} inputMode="numeric" maxLength={15} />
            {err('documento')}
          </label>
          {form.tipo_documento === 'NIT' && (
            <label className={styles.field}>
              Dígito de verificación
              <input value={form.dv} onChange={set('dv')} inputMode="numeric" maxLength={1} />
              {err('dv')}
            </label>
          )}
          <label className={styles.field}>
            Nombre o razón social
            <input value={form.nombre} onChange={set('nombre')} maxLength={150} />
            {err('nombre')}
          </label>
          <label className={styles.field}>
            Tipo de cliente
            <select value={form.tipo} onChange={set('tipo')}>
              {types.map((item) => <option key={item.codigo} value={item.codigo}>{item.nombre}</option>)}
            </select>
            {selected && <span className={styles.muted}>Precio {selected.lista_precios} · descuento máximo {selected.descuento_maximo} %</span>}
          </label>
          <label className={styles.field}>
            Ciudad
            <input value={form.ciudad} onChange={set('ciudad')} maxLength={80} />
            {err('ciudad')}
          </label>
          <label className={styles.field}>
            Dirección
            <input value={form.direccion} onChange={set('direccion')} maxLength={200} />
            {err('direccion')}
          </label>
          <label className={styles.field}>
            Teléfono
            <input value={form.telefono} onChange={set('telefono')} maxLength={20} />
            {err('telefono')}
          </label>
          <label className={styles.field}>
            Correo (opcional)
            <input value={form.correo} onChange={set('correo')} maxLength={120} type="email" />
            {err('correo')}
          </label>
        </div>
        {errors.detail && <p className={styles.formError}>{errors.detail}</p>}
        <div className={styles.actions}>
          <button type="button" className={styles.secondaryBtn} onClick={onClose}>Cancelar</button>
          <button type="submit" className={styles.primaryBtn} disabled={saving}>{saving ? 'Guardando…' : 'Guardar'}</button>
        </div>
      </form>
    </Modal>
  )
}
