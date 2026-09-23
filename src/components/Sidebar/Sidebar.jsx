import { NavLink } from 'react-router-dom'
import { MODULES, hasModuleAccess } from '../../config/roleModules'
import styles from './Sidebar.module.css'

/**
 * Menú lateral con bloqueo visual por rol (HU 1.4 / TE-75).
 *
 * Cada módulo puede estar en uno de tres estados:
 * - Bloqueado por rol: el rol activo no tiene acceso (candado, sin click).
 * - Próximamente: el rol sí tiene acceso, pero el módulo aún no está
 *   construido (etiqueta "Próximamente", sin click).
 * - Disponible: enlace normal de navegación.
 */
const Sidebar = ({ role }) => {
  return (
    <nav className={styles.sidebar} aria-label="Menú principal">
      <ul className={styles.list}>
        {MODULES.map((module) => {
          const allowed = hasModuleAccess(role, module.id)
          const available = allowed && module.ready

          if (available) {
            return (
              <li key={module.id}>
                <NavLink
                  to={module.path}
                  className={({ isActive }) =>
                    `${styles.item} ${isActive ? styles.itemActive : ''}`
                  }
                >
                  {module.label}
                </NavLink>
              </li>
            )
          }

          return (
            <li key={module.id}>
              <span
                className={`${styles.item} ${styles.itemBlocked}`}
                title={
                  allowed
                    ? 'Este módulo todavía no está disponible.'
                    : 'Tu rol no tiene acceso a este módulo.'
                }
              >
                {module.label}
                <span className={styles.badge}>
                  {allowed ? 'Próximamente' : '🔒'}
                </span>
              </span>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}

export default Sidebar
