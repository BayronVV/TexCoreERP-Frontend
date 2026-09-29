import { useAuth } from '../../auth/session'
import styles from './ui.module.css'

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
