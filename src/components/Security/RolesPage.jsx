import { useCallback, useEffect, useMemo, useState } from 'react'
import { apiGet, apiRequest } from '../../api/client'
import { useAuth } from '../../auth/session'
import { MODULES } from '../../config/modules'
import { useToast } from '../ui/toastContext'
import Modal from '../ui/Modal'
import styles from './Security.module.css'

const sameSet = (a, b) => a.size === b.size && [...a].every((x) => b.has(x))

const draftFrom = (role) => ({
  name: role.name,
  description: role.description,
  permissions: new Set(role.permissions),
})

function NewRoleForm({ onCreated, onCancel }) {
  const [form, setForm] = useState({ code: '', name: '', description: '' })
  const [errors, setErrors] = useState({})
  const [saving, setSaving] = useState(false)
  const set = (field) => (event) => setForm((current) => ({ ...current, [field]: event.target.value }))

  const submit = async (event) => {
    event.preventDefault()
    setSaving(true)
    setErrors({})
    try {
      onCreated(await apiRequest('/api/roles/', { method: 'POST', body: form }))
    } catch (error) {
      setErrors(error.body && typeof error.body === 'object' ? error.body : { detail: error.message })
      setSaving(false)
    }
  }

  const fieldError = (name) => errors[name] && <span className={styles.fieldError}>{[].concat(errors[name])[0]}</span>

  return (
    <form onSubmit={submit} className={styles.form}>
      <label className={styles.field}>
        Nombre
        <input value={form.name} onChange={set('name')} placeholder="Ej. Supervisor de planta" required />
        {fieldError('name')}
      </label>
      <label className={styles.field}>
        Código
        <input
          value={form.code}
          onChange={(event) => setForm((current) => ({ ...current, code: event.target.value.toUpperCase() }))}
          placeholder="SUPERVISOR"
          required
        />
        <span className={styles.muted}>No se puede cambiar después. Mayúsculas, números o guion bajo.</span>
        {fieldError('code')}
      </label>
      <label className={styles.field}>
        Descripción
        <input value={form.description} onChange={set('description')} />
      </label>
      {errors.detail && <p className={styles.formError}>{errors.detail}</p>}
      <div className={styles.formActions}>
        <button type="button" className={styles.secondaryBtn} onClick={onCancel}>
          Cancelar
        </button>
        <button type="submit" className={styles.primaryBtn} disabled={saving}>
          {saving ? 'Creando...' : 'Crear rol'}
        </button>
      </div>
    </form>
  )
}

// Se monta con key={role.id}: al elegir otro rol el borrador arranca limpio.
function RoleEditor({ role, permissions, canEdit, onSaved, onDelete }) {
  const notify = useToast()
  const [draft, setDraft] = useState(() => draftFrom(role))
  const [saving, setSaving] = useState(false)

  const groups = useMemo(() => {
    const byModule = new Map(MODULES.map((m) => [m.id, { module: m, perms: [] }]))
    permissions.forEach((perm) => {
      if (!byModule.has(perm.module))
        byModule.set(perm.module, { module: { id: perm.module, label: perm.module }, perms: [] })
      byModule.get(perm.module).perms.push(perm)
    })
    return [...byModule.values()].filter((group) => group.perms.length > 0)
  }, [permissions])

  const fixedPermissions = role.code === 'ADMIN' || role.code === 'PENDING'
  const matrixLocked = !canEdit || fixedPermissions
  const dirty =
    draft.name !== role.name ||
    draft.description !== role.description ||
    !sameSet(draft.permissions, new Set(role.permissions))

  const isChecked = (code) => role.has_all_permissions || draft.permissions.has(code)

  // "Registrar y modificar" sin "Ver" no tiene sentido: se marcan y desmarcan juntos.
  const toggle = (perm) => {
    setDraft((current) => {
      const next = new Set(current.permissions)
      const viewCode = `${perm.module}.ver`
      if (next.has(perm.code)) {
        next.delete(perm.code)
        if (perm.code === viewCode) {
          permissions.filter((p) => p.module === perm.module).forEach((p) => next.delete(p.code))
        }
      } else {
        next.add(perm.code)
        next.add(viewCode)
      }
      return { ...current, permissions: next }
    })
  }

  const save = async () => {
    setSaving(true)
    try {
      const body = { name: draft.name, description: draft.description }
      if (!fixedPermissions) body.permissions = [...draft.permissions]
      const updated = await apiRequest(`/api/roles/${role.id}/`, { method: 'PATCH', body })
      onSaved(updated)
      notify(`Rol "${updated.name}" guardado. Los usuarios con este rol verán el cambio al recargar la página.`)
    } catch (error) {
      notify(error.message, 'error')
    } finally {
      setSaving(false)
    }
  }

  const checkbox = (perm) =>
    perm && (
      <input
        type="checkbox"
        checked={isChecked(perm.code)}
        disabled={matrixLocked}
        onChange={() => toggle(perm)}
        aria-label={perm.name}
      />
    )

  return (
    <section className={styles.card}>
      <div className={styles.formRow}>
        <label className={styles.field}>
          Nombre
          <input
            value={draft.name}
            disabled={!canEdit}
            onChange={(event) => setDraft((current) => ({ ...current, name: event.target.value }))}
          />
        </label>
        <label className={styles.field}>
          Descripción
          <input
            value={draft.description}
            disabled={!canEdit}
            onChange={(event) => setDraft((current) => ({ ...current, description: event.target.value }))}
          />
        </label>
      </div>

      {role.code === 'ADMIN' && (
        <p className={styles.note}>El Administrador tiene todos los permisos y no se puede restringir.</p>
      )}
      {role.code === 'PENDING' && (
        <p className={styles.note}>Las cuentas pendientes no acceden a ningún módulo hasta que se les asigne un rol.</p>
      )}

      <div className={styles.tableWrap}>
        <table className={`${styles.table} ${styles.matrix}`}>
          <thead>
            <tr>
              <th>Módulo</th>
              <th>Ver</th>
              <th>Registrar y modificar</th>
              <th>Otros</th>
            </tr>
          </thead>
          <tbody>
            {groups.map(({ module, perms }) => {
              const view = perms.find((p) => p.code === `${module.id}.ver`)
              const manage = perms.find((p) => p.code === `${module.id}.gestionar`)
              const extras = perms.filter((p) => p !== view && p !== manage)
              return (
                <tr key={module.id}>
                  <td>{module.label}</td>
                  <td>{checkbox(view)}</td>
                  <td>{checkbox(manage)}</td>
                  <td>
                    {extras.map((perm) => (
                      <label key={perm.code} className={styles.inlineCheck}>
                        {checkbox(perm)} {perm.name}
                      </label>
                    ))}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {canEdit && (
        <div className={styles.formActions}>
          {!role.is_system && (
            <button
              type="button"
              className={`${styles.linkBtn} ${styles.dangerText}`}
              disabled={role.users_count > 0}
              title={role.users_count > 0 ? 'Reasigna sus usuarios antes de eliminarlo.' : undefined}
              onClick={onDelete}
            >
              Eliminar rol
            </button>
          )}
          <button
            type="button"
            className={styles.secondaryBtn}
            disabled={!dirty}
            onClick={() => setDraft(draftFrom(role))}
          >
            Descartar
          </button>
          <button type="button" className={styles.primaryBtn} disabled={!dirty || saving} onClick={save}>
            {saving ? 'Guardando...' : 'Guardar cambios'}
          </button>
        </div>
      )}
    </section>
  )
}

export default function RolesPage() {
  const { can, refresh } = useAuth()
  const notify = useToast()
  const canEdit = can('seguridad.roles')

  const [roles, setRoles] = useState([])
  const [permissions, setPermissions] = useState([])
  const [selectedId, setSelectedId] = useState(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [creating, setCreating] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)

  const load = useCallback(async () => {
    try {
      const [roleList, permList] = await Promise.all([apiGet('/api/roles/'), apiGet('/api/permissions/')])
      setRoles(roleList)
      setPermissions(permList)
      setSelectedId((current) => current ?? roleList[0]?.id ?? null)
      setLoadError('')
    } catch (error) {
      setLoadError(error.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const role = roles.find((r) => r.id === selectedId)

  const deleteRole = async () => {
    setConfirmDelete(false)
    try {
      await apiRequest(`/api/roles/${role.id}/`, { method: 'DELETE' })
      const rest = roles.filter((r) => r.id !== role.id)
      setRoles(rest)
      setSelectedId(rest[0]?.id ?? null)
      notify(`Rol "${role.name}" eliminado.`)
    } catch (error) {
      notify(error.message, 'error')
    }
  }

  if (loading) return <div className={styles.page}>Cargando roles...</div>
  if (loadError) {
    return (
      <div className={styles.page}>
        <p className={styles.formError}>{loadError}</p>
        <button
          type="button"
          className={styles.secondaryBtn}
          onClick={() => {
            setLoading(true)
            load()
          }}
        >
          Reintentar
        </button>
      </div>
    )
  }

  return (
    <div className={styles.page}>
      <div className={styles.pageHeader}>
        <div>
          <p className={styles.eyebrow}>Seguridad</p>
          <h1>Roles y permisos</h1>
          <p className={styles.subtitle}>Define qué módulos puede ver y operar cada rol.</p>
        </div>
        {canEdit && (
          <button type="button" className={styles.primaryBtn} onClick={() => setCreating(true)}>
            + Nuevo rol
          </button>
        )}
      </div>

      <div className={styles.rolesLayout}>
        <ul className={styles.roleList}>
          {roles.map((r) => (
            <li key={r.id}>
              <button
                type="button"
                className={`${styles.roleItem} ${r.id === selectedId ? styles.roleItemActive : ''}`}
                onClick={() => setSelectedId(r.id)}
              >
                <span>
                  <strong>{r.name}</strong>
                  <span className={styles.muted}>{r.code}</span>
                </span>
                <span className={styles.roleMeta}>
                  {r.users_count} {r.users_count === 1 ? 'usuario' : 'usuarios'}
                  {r.is_system && <span className={styles.systemTag}>Base</span>}
                </span>
              </button>
            </li>
          ))}
        </ul>

        {role && (
          <RoleEditor
            key={role.id}
            role={role}
            permissions={permissions}
            canEdit={canEdit}
            onSaved={(updated) => {
              setRoles((current) => current.map((r) => (r.id === updated.id ? updated : r)))
              refresh()
            }}
            onDelete={() => setConfirmDelete(true)}
          />
        )}
      </div>

      {creating && (
        <Modal title="Nuevo rol" onClose={() => setCreating(false)}>
          <NewRoleForm
            onCancel={() => setCreating(false)}
            onCreated={(created) => {
              setRoles((current) => [...current, created])
              setSelectedId(created.id)
              setCreating(false)
              notify(`Rol "${created.name}" creado. Ahora marca sus permisos.`)
            }}
          />
        </Modal>
      )}

      {confirmDelete && role && (
        <Modal title="Eliminar rol" onClose={() => setConfirmDelete(false)}>
          <p className={styles.confirmText}>
            ¿Eliminar el rol "{role.name}"? No se puede deshacer desde la aplicación.
          </p>
          <div className={styles.formActions}>
            <button type="button" className={styles.secondaryBtn} onClick={() => setConfirmDelete(false)}>
              Cancelar
            </button>
            <button type="button" className={styles.dangerBtn} onClick={deleteRole}>
              Eliminar
            </button>
          </div>
        </Modal>
      )}
    </div>
  )
}
