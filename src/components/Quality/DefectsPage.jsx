import { useCallback, useEffect, useState } from 'react'
import { apiGet, apiRequest } from '../../api/client'
import { useAuth } from '../../auth/session'
import { useToast } from '../ui/toastContext'
import Modal from '../ui/Modal'
import { fieldErrors } from '../Inventory/labels'
import styles from '../Inventory/Inventory.module.css'
import qualityStyles from './Quality.module.css'
import { defectBody, defectForm, defectKindLabel, defectNameProblem, emptyDefectForm } from './quality'

// Crear o editar un defecto del catálogo. Los defectos no se borran: se desactivan, para no romper las inspecciones ya hechas.
function DefectForm({ defect, onSaved, onClose }) {
  const notify = useToast()
  const editing = Boolean(defect)
  const [form, setForm] = useState(editing ? defectForm(defect) : emptyDefectForm())
  const [errors, setErrors] = useState({})
  const [saving, setSaving] = useState(false)
  const set = (field) => (event) => setForm((current) => ({ ...current, [field]: event.target.value }))
  const problem = defectNameProblem(form.nombre)

  const submit = async (event) => {
    event.preventDefault()
    if (problem) return setErrors({ nombre: problem })
    setSaving(true)
    setErrors({})
    try {
      const saved = await apiRequest(editing ? `/api/calidad/defectos/${defect.id}/` : '/api/calidad/defectos/', {
        method: editing ? 'PATCH' : 'POST', body: defectBody(form),
      })
      notify(editing ? `Defecto ${saved.codigo} actualizado.` : `Defecto ${saved.codigo} creado.`)
      onSaved(saved)
    } catch (error) {
      setErrors(fieldErrors(error))
      setSaving(false)
    }
  }

  const err = (name) => errors[name] && <span className={styles.fieldError}>{errors[name]}</span>

  return (
    <Modal title={editing ? `Editar ${defect.codigo}` : 'Nuevo defecto'} onClose={onClose}>
      <form className={styles.form} onSubmit={submit} noValidate>
        <label className={styles.field}>
          Nombre
          <input value={form.nombre} onChange={set('nombre')} maxLength={80} placeholder="Ej. Costura floja" required />
          {err('nombre')}
        </label>
        <label className={styles.field}>
          Descripción (opcional)
          <input value={form.descripcion} onChange={set('descripcion')} maxLength={255} />
          {err('descripcion')}
        </label>
        <label className={styles.field}>
          Tipo
          <select value={form.corregible} onChange={set('corregible')}>
            <option value="si">Corregible (se puede reprocesar)</option>
            <option value="no">Incorregible (marra definitiva)</option>
          </select>
        </label>
        {errors.detail && <p className={styles.formError}>{errors.detail}</p>}
        <div className={styles.actions}>
          <button type="button" className={styles.secondaryBtn} onClick={onClose}>Cancelar</button>
          <button type="submit" className={styles.primaryBtn} disabled={saving}>{saving ? 'Guardando…' : editing ? 'Guardar cambios' : 'Crear defecto'}</button>
        </div>
      </form>
    </Modal>
  )
}

// Catálogo de defectos de calidad (RF19): qué se puede encontrar en una prenda y si se puede corregir o es marra definitiva.
export default function DefectsPage() {
  const { can } = useAuth()
  const notify = useToast()
  const canManage = can('calidad.gestionar')
  const [defects, setDefects] = useState(null)
  const [search, setSearch] = useState('')
  const [showOff, setShowOff] = useState(false)
  const [loadError, setLoadError] = useState('')
  const [editing, setEditing] = useState(null) // null | 'new' | defecto

  const load = useCallback(() => {
    const params = new URLSearchParams({ limit: '200' })
    if (search.trim()) params.set('q', search.trim())
    if (!showOff) params.set('activo', 'true')
    apiGet(`/api/calidad/defectos/?${params}`).then((data) => (setDefects(data), setLoadError(''))).catch((error) => setLoadError(error.message))
  }, [search, showOff])

  useEffect(() => {
    const timer = setTimeout(load, 250)
    return () => clearTimeout(timer)
  }, [load])

  const toggle = async (defect) => {
    try {
      await apiRequest(`/api/calidad/defectos/${defect.id}/`, { method: 'PATCH', body: { activo: !defect.activo } })
      notify(defect.activo ? `${defect.nombre} desactivado.` : `${defect.nombre} activado.`)
      load()
    } catch (error) {
      notify(fieldErrors(error).nombre ?? error.message, 'error')
    }
  }

  return (
    <div className={styles.page}>
      <header className={`${styles.pageHeader} ${qualityStyles.headerRow}`}>
        <div>
          <p className={styles.eyebrow}>Control de calidad</p>
          <h1>Defectos</h1>
          <p className={styles.subtitle}>
            Catálogo de lo que se puede encontrar en una prenda. Un defecto corregible se puede reprocesar; uno incorregible es marra
            definitiva. No se borran: se desactivan para conservar el historial.
          </p>
        </div>
        {canManage && <button type="button" className={styles.primaryBtn} onClick={() => setEditing('new')}>+ Nuevo defecto</button>}
      </header>

      <section className={styles.card}>
        <div className={styles.filters}>
          <input type="search" placeholder="Buscar por código o nombre" value={search} onChange={(event) => setSearch(event.target.value)} aria-label="Buscar defectos" />
          <label>
            <input type="checkbox" checked={showOff} onChange={(event) => setShowOff(event.target.checked)} /> Mostrar desactivados
          </label>
        </div>
        {loadError && <p className={styles.formError}>{loadError}</p>}
        {defects && defects.length === 0 && <p className={styles.empty}>{search ? 'Ningún defecto coincide con la búsqueda.' : 'Todavía no hay defectos en el catálogo.'}</p>}
        {defects && defects.length > 0 && (
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead><tr><th>Código</th><th>Defecto</th><th>Tipo</th><th>Descripción</th><th>Estado</th><th /></tr></thead>
              <tbody>
                {defects.map((defect) => (
                  <tr key={defect.id}>
                    <td><strong>{defect.codigo}</strong></td>
                    <td>{defect.nombre}</td>
                    <td><span className={`${styles.badge} ${defect.corregible ? styles.badgeWarn : styles.badgeDanger}`}>{defectKindLabel(defect)}</span></td>
                    <td className={qualityStyles.noteCell}>{defect.descripcion || '—'}</td>
                    <td><span className={`${styles.badge} ${defect.activo ? styles.badgeOk : styles.badgeOff}`}>{defect.activo ? 'Activo' : 'Desactivado'}</span></td>
                    <td>
                      {canManage && (
                        <span className={qualityStyles.rowActions}>
                          <button type="button" className={styles.linkBtn} onClick={() => setEditing(defect)}>Editar</button>
                          <button type="button" className={styles.linkBtn} onClick={() => toggle(defect)}>{defect.activo ? 'Desactivar' : 'Activar'}</button>
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {editing && (
        <DefectForm defect={editing === 'new' ? null : editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); load() }} />
      )}
    </div>
  )
}
