import { NavLink } from 'react-router-dom'
import { useAuth } from '../../auth/session'
import { MODULES } from '../../config/modules'
import styles from './Sidebar.module.css'

const linkClass = ({ isActive }) => `${styles.item} ${isActive ? styles.itemActive : ''}`

/**
 * Menú lateral construido con `config/modules.js`. Solo muestra los módulos para los que el usuario tiene `<módulo>.ver`
 * (y no los marcados `hidden`, como Fichas Técnicas); un módulo permitido sin pantalla aparece como «Próximamente».
 */
const Sidebar = () => {
  const { can } = useAuth()

  return (
    <nav className={styles.sidebar} aria-label="Menú principal">
      <NavLink to="/dashboard" className={linkClass} end>
        Inicio
      </NavLink>

      <ul className={styles.list}>
        {MODULES.filter((module) => !module.hidden && can(`${module.id}.ver`)).map((module) => {
          // Lo que el rol no puede ver no se muestra: ni el nombre ni un candado.
          // Un módulo permitido pero sin pantalla todavía sí aparece, como "Próximamente".
          if (!module.path && !module.children) {
            return (
              <li key={module.id}>
                <span className={`${styles.item} ${styles.itemBlocked}`} aria-disabled="true">
                  {module.label}
                  <span className={styles.badge}>Próximamente</span>
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
                      <NavLink to={child.path} end className={linkClass}>
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
