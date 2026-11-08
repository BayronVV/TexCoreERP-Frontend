import styles from './Shipping.module.css'
import { colorKey, colorLabel } from './shipping'

/** Insignia de semáforo de una guía: el color y el nombre del estado (el color no es lo único que lo dice). */
export default function GuideBadge({ color, name }) {
  return (
    <span className={`${styles.badge} ${styles[colorKey(color)]}`} title={`Semáforo ${colorLabel(color).toLowerCase()}`}>
      {name}
    </span>
  )
}
