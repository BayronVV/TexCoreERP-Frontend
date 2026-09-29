import { NavLink } from 'react-router-dom'
import { useAuth } from '../../auth/session'
import { MODULES } from '../../config/modules'
import styles from './Sidebar.module.css'

const linkClass = ({ isActive }) => `${styles.item} ${isActive ? styles.itemActive : ''}`

const Sidebar = () => {
  const { can } = useAuth()

  return (
    <nav className={styles.sidebar} aria-label="Menú principal">
      <NavLink to="/dashboard" className={linkClass} end>
        Inicio
      </NavLink>

      <ul className={styles.list}>
        {MODULES.map((module) => {
          const allowed = can(`${module.id}.ver`)
          const built = Boolean(module.path || module.children)

          if (!allowed || !built) {
            return (
              <li key={module.id}>
                <span className={`${styles.item} ${styles.itemBlocked}`} aria-disabled="true">
                  {module.label}
                  <span className={styles.badge} title={allowed ? undefined : 'Tu rol no tiene acceso a este módulo.'}>
                    {allowed ? 'Próximamente' : <span aria-hidden="true">🔒</span>}
                    {!allowed && <span className={styles.srOnly}>Sin acceso</span>}
                  </span>
                </span>
              </li>
            )
          }

          if (module.children) {
            return (
              <li key={module.id}>
                <span className={styles.groupLabel}>{module.label}</span>
                <ul className={styles.subList}>
                  {module.children.map((child) => (
                    <li key={child.path}>
                      <NavLink to={child.path} className={linkClass}>
                        {child.label}
                      </NavLink>
                    </li>
                  ))}
                </ul>
              </li>
            )
          }

          return (
            <li key={module.id}>
              <NavLink to={module.path} className={linkClass}>
                {module.label}
              </NavLink>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}

export default Sidebar
