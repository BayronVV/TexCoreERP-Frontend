import { Link, Outlet } from 'react-router-dom'
import { AuthProvider } from '../../auth/AuthContext'
import { useAuth } from '../../auth/session'
import { ToastProvider } from '../ui/Toast'
import Sidebar from '../Sidebar/Sidebar'
import styles from './AppLayout.module.css'

function PendingNotice({ user }) {
  const area = user.requested_area_name
  return (
    <section className={styles.notice}>
      <h1>Tu cuenta está pendiente de aprobación</h1>
      <p>Un administrador debe asignarte un rol antes de que puedas usar el sistema.</p>
      {area && <p>Área que solicitaste: {area}.</p>}
    </section>
  )
}

function Shell() {
  const { user, loadError, reloadUser, logout } = useAuth()

  if (loadError) {
    return (
      <div className={styles.loading}>
        <p>{loadError}</p>
        <button type="button" className={styles.retryBtn} onClick={reloadUser}>
          Reintentar
        </button>
      </div>
    )
  }
  if (!user) return <div className={styles.loading}>Cargando...</div>

  const pending = user.role === 'PENDING'

  return (
    <div className={styles.app}>
      <header className={styles.header}>
        <Link to="/dashboard" className={styles.brand}>
          TexCore<span>ERP</span>
        </Link>
        <div className={styles.userInfo}>
          <div className={styles.userText}>
            <strong>{user.full_name}</strong>
            <span>{user.role_name}</span>
          </div>
          <button type="button" onClick={logout} className={styles.logoutBtn}>
            Cerrar sesión
          </button>
        </div>
      </header>

      <div className={styles.body}>
        {!pending && <Sidebar />}
        <main className={styles.main}>{pending ? <PendingNotice user={user} /> : <Outlet />}</main>
      </div>
    </div>
  )
}

export default function AppLayout() {
  return (
    <AuthProvider>
      <ToastProvider>
        <Shell />
      </ToastProvider>
    </AuthProvider>
  )
}
