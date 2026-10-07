import { useAuth } from '../../auth/session'
import styles from './ui.module.css'

/**
 * Muestra a sus hijos solo si el rol del usuario tiene el permiso; si no, un aviso de acceso denegado.
 * La decisión real la toma el backend (403); esto solo evita mostrar pantallas vacías.
 *
 * @param {{code: string, children: import('react').ReactNode}} props `code` p. ej. `inventario.ver`.
 */
export default function RequirePermission({ code, children }) {
  const { can } = useAuth()
  if (can(code)) return children
  return (
    <section className={styles.forbidden}>
      <h2>No tienes acceso a esta sección</h2>
      <p>Tu rol no incluye este permiso. Si lo necesitas, pídeselo a un administrador.</p>
    </section>
  )
}
