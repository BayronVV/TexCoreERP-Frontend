import { Link } from 'react-router-dom'
import { tracePath } from './trace'
import inv from '../Inventory/Inventory.module.css'

/**
 * Enlace «Ver trazabilidad» (HU 7.6) de un lote, una factura o una orden (que abre la búsqueda para elegir su lote).
 *
 * @param {{tipo: 'lote'|'factura'|'orden', codigo: string, children?: import('react').ReactNode}} props
 */
export default function TraceLink({ tipo, codigo, children = 'Ver trazabilidad' }) {
  if (!codigo) return null
  const to = tipo === 'orden' ? `/trazabilidad?codigo=${encodeURIComponent(codigo)}` : tracePath(tipo, codigo)
  return (
    <Link className={inv.textLink} to={to} aria-label={`Ver trazabilidad de ${codigo}`}>
      {children}
    </Link>
  )
}
