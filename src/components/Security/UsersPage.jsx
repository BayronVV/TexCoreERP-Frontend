import { useCallback, useEffect, useMemo, useState } from 'react'
import { apiGet, apiRequest } from '../../api/client'
import { useAuth } from '../../auth/session'
import { useToast } from '../ui/toastContext'
import Modal from '../ui/Modal'
import styles from './Security.module.css'

const EMPTY_FORM = { first_name: '', last_name: '', email: '', document_id: '', role: '' }

const formatDate = (value) =>
  value ? new Date(value).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'

function statusOf(user) {
  if (!user.is_active) return { label: 'Inactivo', className: styles.badgeOff }
  if (user.role === 'PENDING') return { label: 'Pendiente', className: styles.badgeWarn }
  return { label: 'Activo', className: styles.badgeOn }
}

function CreateUserForm({ roles, onCreated, onCancel }) {
  const notify = useToast()
  const [form, setForm] = useState(EMPTY_FORM)
  const [errors, setErrors] = useState({})
  const [saving, setSaving] = useState(false)

  const set = (field) => (event) => setForm((current) => ({ ...current, [field]: event.target.value }))

  const submit = async (event) => {
    event.preventDefault()
    setSaving(true)
    setErrors({})
    try {
      const user = await apiRequest('/api/users/', { method: 'POST', body: form })
      if (user.email_sent) {
        notify(`Cuenta creada. Enviamos el enlace de activación a ${user.email}.`)
      } else {
        notify('Cuenta creada, pero no se pudo enviar el correo. Usa "Reenviar enlace" en unos minutos.', 'error')
      }
      onCreated(user)
    } catch (error) {
      setErrors(error.body && typeof error.body === 'object' ? error.body : { detail: error.message })
    } finally {
      setSaving(false)
    }
  }

  const fieldError = (name) => errors[name] && <span className={styles.fieldError}>{[].concat(errors[name])[0]}</span>

  return (
    <form onSubmit={submit} className={styles.form}>
      <p className={styles.formHint}>Le llegará un correo con un enlace para definir su contraseña.</p>
      <div className={styles.formRow}>
        <label className={styles.field}>
          Nombres
          <input value={form.first_name} onChange={set('first_name')} required />
          {fieldError('first_name')}
        </label>
        <label className={styles.field}>
          Apellidos
          <input value={form.last_name} onChange={set('last_name')} required />
          {fieldError('last_name')}
        </label>
      </div>
      <label className={styles.field}>
        Correo
        <input type="email" value={form.email} onChange={set('email')} required />
        {fieldError('email')}
      </label>
      <div className={styles.formRow}>
        <label className={styles.field}>
          Cédula (opcional)
          <input value={form.document_id} onChange={set('document_id')} maxLength={20} />
          {fieldError('document_id')}
        </label>
        <label className={styles.field}>
          Rol
          <select value={form.role} onChange={set('role')} required>
            <option value="" disabled>
              Selecciona un rol
            </option>
            {roles
              .filter((role) => role.code !== 'PENDING')
              .map((role) => (
                <option key={role.code} value={role.code}>
                  {role.name}
                </option>
              ))}
          </select>
          {fieldError('role')}
        </label>
      </div>
      {errors.detail && <p className={styles.formError}>{errors.detail}</p>}
      <div className={styles.formActions}>
        <button type="button" className={styles.secondaryBtn} onClick={onCancel}>
          Cancelar
        </button>
        <button type="submit" className={styles.primaryBtn} disabled={saving}>
          {saving ? 'Creando...' : 'Crear y enviar invitación'}
        </button>
      </div>
    </form>
  )
}

export default function UsersPage() {
  const { user: me, can } = useAuth()
  const notify = useToast()
  const canManage = can('seguridad.gestionar')

  const [users, setUsers] = useState([])
  const [roles, setRoles] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [filters, setFilters] = useState({ q: '', role: '', status: '' })
  const [busyId, setBusyId] = useState(null)
  const [creating, setCreating] = useState(false)
  const [confirm, setConfirm] = useState(null)
  const [approvals, setApprovals] = useState({})

  const load = useCallback(async () => {
    try {
      const [userList, roleList] = await Promise.all([apiGet('/api/users/'), apiGet('/api/roles/')])
      setUsers(userList)
      setRoles(roleList)
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

  const replaceUser = (updated) => setUsers((current) => current.map((u) => (u.id === updated.id ? updated : u)))

  const run = async (userId, action, successMessage) => {
    setBusyId(userId)
    try {
      await action()
      if (successMessage) notify(successMessage)
    } catch (error) {
      notify(error.message, 'error')
    } finally {
      setBusyId(null)
    }
  }

  const changeRole = (user, role) =>
    run(
      user.id,
      async () => {
        replaceUser(await apiRequest(`/api/users/${user.id}/`, { method: 'PATCH', body: { role } }))
      },
      `Rol de ${user.full_name} actualizado.`,
    )

  const setActive = (user, isActive) =>
    run(
      user.id,
      async () => {
        replaceUser(await apiRequest(`/api/users/${user.id}/`, { method: 'PATCH', body: { is_active: isActive } }))
      },
      isActive ? `${user.full_name} puede volver a iniciar sesión.` : `${user.full_name} ya no puede iniciar sesión.`,
    )

  const removeUser = (user) =>
    run(
      user.id,
      async () => {
        await apiRequest(`/api/users/${user.id}/`, { method: 'DELETE' })
        setUsers((current) => current.filter((u) => u.id !== user.id))
      },
      `${user.full_name} fue eliminado.`,
    )

  const resendInvite = (user) =>
    run(user.id, async () => {
      const response = await apiRequest(`/api/users/${user.id}/invite/`, { method: 'POST' })
      notify(response.detail)
    })

  // Dar o quitar el rol de Administrador pide confirmación: es el cambio con más impacto.
  const requestRoleChange = (user, role) => {
    if (role !== 'ADMIN' && user.role !== 'ADMIN') {
      changeRole(user, role)
      return
    }
    const roleName = roles.find((r) => r.code === role)?.name ?? role
    setConfirm({
      title: role === 'ADMIN' ? 'Dar rol de Administrador' : 'Quitar rol de Administrador',
      message:
        role === 'ADMIN'
          ? `${user.full_name} tendrá acceso total, incluida la gestión de usuarios y roles.`
          : `${user.full_name} pasará a ${roleName} y perderá el acceso de administrador.`,
      label: 'Confirmar',
      action: () => changeRole(user, role),
    })
  }

  const pending = users.filter((u) => u.role === 'PENDING' && u.is_active)
  const assignableRoles = roles.filter((role) => role.code !== 'PENDING')

  const visible = useMemo(() => {
    const q = filters.q.trim().toLowerCase()
    return users.filter((u) => {
      if (q && !`${u.full_name} ${u.email} ${u.document_id ?? ''}`.toLowerCase().includes(q)) return false
      if (filters.role && u.role !== filters.role) return false
      if (filters.status && statusOf(u).label !== filters.status) return false
      return true
    })
  }, [users, filters])

  const setFilter = (field) => (event) => setFilters((current) => ({ ...current, [field]: event.target.value }))

  if (loading) return <div className={styles.page}>Cargando usuarios...</div>
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
          <h1>Usuarios</h1>
          <p className={styles.subtitle}>Aprueba registros, asigna roles y controla quién puede entrar al sistema.</p>
        </div>
        {canManage && (
          <button type="button" className={styles.primaryBtn} onClick={() => setCreating(true)}>
            + Nuevo usuario
          </button>
        )}
      </div>

      {canManage && pending.length > 0 && (
        <section className={styles.card}>
          <h2 className={styles.cardTitle}>
            Solicitudes pendientes <span className={styles.counter}>{pending.length}</span>
          </h2>
          <ul className={styles.requestList}>
            {pending.map((user) => {
              const chosen = approvals[user.id] ?? user.requested_area ?? ''
              return (
                <li key={user.id} className={styles.request}>
                  <div>
                    <strong>{user.full_name}</strong>
                    <span className={styles.muted}>{user.email}</span>
                    <span className={styles.muted}>
                      Solicitó: {user.requested_area_name ?? 'sin área'} · {formatDate(user.date_joined)}
                    </span>
                  </div>
                  <div className={styles.requestActions}>
                    <select
                      value={chosen}
                      onChange={(event) => setApprovals((current) => ({ ...current, [user.id]: event.target.value }))}
                      aria-label={`Rol para ${user.full_name}`}
                    >
                      <option value="" disabled>
                        Elige un rol
                      </option>
                      {assignableRoles.map((role) => (
                        <option key={role.code} value={role.code}>
                          {role.name}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      className={styles.primaryBtn}
                      disabled={!chosen || busyId === user.id}
                      onClick={() => requestRoleChange(user, chosen)}
                    >
                      Aprobar
                    </button>
                    <button
                      type="button"
                      className={styles.ghostBtn}
                      disabled={busyId === user.id}
                      onClick={() =>
                        setConfirm({
                          title: 'Rechazar solicitud',
                          message: `${user.full_name} no podrá iniciar sesión. Puedes reactivar la cuenta después si fue un error.`,
                          label: 'Rechazar',
                          action: () => setActive(user, false),
                        })
                      }
                    >
                      Rechazar
                    </button>
                  </div>
                </li>
              )
            })}
          </ul>
        </section>
      )}

      <section className={styles.card}>
        <div className={styles.filters}>
          <input
            type="search"
            placeholder="Buscar por nombre, correo o cédula"
            value={filters.q}
            onChange={setFilter('q')}
          />
          <select value={filters.role} onChange={setFilter('role')} aria-label="Filtrar por rol">
            <option value="">Todos los roles</option>
            {roles.map((role) => (
              <option key={role.code} value={role.code}>
                {role.name}
              </option>
            ))}
          </select>
          <select value={filters.status} onChange={setFilter('status')} aria-label="Filtrar por estado">
            <option value="">Todos los estados</option>
            <option>Activo</option>
            <option>Pendiente</option>
            <option>Inactivo</option>
          </select>
        </div>

        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Usuario</th>
                <th>Cédula</th>
                <th>Rol</th>
                <th>Estado</th>
                <th>Último acceso</th>
                {canManage && <th aria-label="Acciones" />}
              </tr>
            </thead>
            <tbody>
              {visible.map((user) => {
                const status = statusOf(user)
                const isMe = user.id === me.id
                const busy = busyId === user.id
                return (
                  <tr key={user.id} className={!user.is_active ? styles.rowOff : undefined}>
                    <td>
                      <strong>{user.full_name}</strong>
                      {isMe && <span className={styles.youTag}>tú</span>}
                      <span className={styles.muted}>{user.email}</span>
                    </td>
                    <td>{user.document_id || '—'}</td>
                    <td>
                      {canManage && !isMe ? (
                        <select
                          value={user.role}
                          disabled={busy}
                          onChange={(event) => requestRoleChange(user, event.target.value)}
                          aria-label={`Rol de ${user.full_name}`}
                        >
                          {user.role === 'PENDING' && (
                            <option value="PENDING" disabled>
                              Pendiente de aprobación
                            </option>
                          )}
                          {assignableRoles.map((role) => (
                            <option key={role.code} value={role.code}>
                              {role.name}
                            </option>
                          ))}
                        </select>
                      ) : (
                        user.role_name
                      )}
                    </td>
                    <td>
                      <span className={`${styles.badge} ${status.className}`}>{status.label}</span>
                    </td>
                    <td>
                      {user.last_login ? formatDate(user.last_login) : <span className={styles.muted}>Nunca</span>}
                    </td>
                    {canManage && (
                      <td className={styles.rowActions}>
                        {!isMe && (
                          <>
                            {!user.has_password && user.is_active && (
                              <button
                                type="button"
                                className={styles.linkBtn}
                                disabled={busy}
                                onClick={() => resendInvite(user)}
                              >
                                Reenviar enlace
                              </button>
                            )}
                            {user.is_active ? (
                              <button
                                type="button"
                                className={styles.linkBtn}
                                disabled={busy}
                                onClick={() =>
                                  setConfirm({
                                    title: 'Desactivar usuario',
                                    message: `${user.full_name} no podrá iniciar sesión hasta que lo reactives.`,
                                    label: 'Desactivar',
                                    action: () => setActive(user, false),
                                  })
                                }
                              >
                                Desactivar
                              </button>
                            ) : (
                              <button
                                type="button"
                                className={styles.linkBtn}
                                disabled={busy}
                                onClick={() => setActive(user, true)}
                              >
                                Activar
                              </button>
                            )}
                            <button
                              type="button"
                              className={`${styles.linkBtn} ${styles.dangerText}`}
                              disabled={busy}
                              onClick={() =>
                                setConfirm({
                                  title: 'Eliminar usuario',
                                  message: `${user.full_name} desaparecerá de la lista y no podrá iniciar sesión. Sus registros históricos se conservan.`,
                                  label: 'Eliminar',
                                  danger: true,
                                  action: () => removeUser(user),
                                })
                              }
                            >
                              Eliminar
                            </button>
                          </>
                        )}
                      </td>
                    )}
                  </tr>
                )
              })}
            </tbody>
          </table>
          {visible.length === 0 && <p className={styles.empty}>No hay usuarios que coincidan con los filtros.</p>}
        </div>
      </section>

      {creating && (
        <Modal title="Nuevo usuario" onClose={() => setCreating(false)}>
          <CreateUserForm
            roles={roles}
            onCancel={() => setCreating(false)}
            onCreated={(user) => {
              setUsers((current) => [user, ...current])
              setCreating(false)
            }}
          />
        </Modal>
      )}

      {confirm && (
        <Modal title={confirm.title} onClose={() => setConfirm(null)}>
          <p className={styles.confirmText}>{confirm.message}</p>
          <div className={styles.formActions}>
            <button type="button" className={styles.secondaryBtn} onClick={() => setConfirm(null)}>
              Cancelar
            </button>
            <button
              type="button"
              className={confirm.danger ? styles.dangerBtn : styles.primaryBtn}
              onClick={() => {
                confirm.action()
                setConfirm(null)
              }}
            >
              {confirm.label}
            </button>
          </div>
        </Modal>
      )}
    </div>
  )
}
