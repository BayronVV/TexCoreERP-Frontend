import Modal from '../ui/Modal'
import { formatDate, formatQty } from '../Inventory/labels'
import { formatMoney } from '../Inventory/money'
import styles from '../Inventory/Inventory.module.css'
import purchasingStyles from './Purchasing.module.css'
import { STATE_TONE, orderProgress } from './purchasing'

/** Insignia con el estado de una orden de compra. */
export function OrderBadge({ order }) {
  return <span className={`${styles.badge} ${styles[STATE_TONE[order.estado]] ?? ''}`}>{order.estado_nombre}</span>
}

/** Barra de avance de recepción de una orden (líneas completas y porcentaje). */
export function OrderProgress({ order }) {
  const { complete, total, percent } = orderProgress(order)
  return (
    <span className={purchasingStyles.progress} title={`${complete} de ${total} líneas completas`}>
      <span className={purchasingStyles.progressBar}><span className={purchasingStyles.progressFill} style={{ width: `${percent}%` }} /></span>
      <span className={purchasingStyles.progressText}>{percent}%</span>
    </span>
  )
}

// Consulta de una orden: datos, líneas con lo recibido y lo pendiente, y las recepciones hechas contra ella.
export default function OrderDetail({ order, onClose }) {
  return (
    <Modal title={`Orden ${order.codigo}`} onClose={onClose} wide>
      <dl className={purchasingStyles.detailGrid}>
        <div><dt>Estado</dt><dd><OrderBadge order={order} /></dd></div>
        <div><dt>Proveedor</dt><dd>{order.proveedor_nombre}</dd></div>
        <div><dt>Fecha</dt><dd>{formatDate(order.fecha)}</dd></div>
        <div><dt>Fecha esperada</dt><dd>{formatDate(order.fecha_esperada)}</dd></div>
        <div><dt>Condiciones de pago</dt><dd>{order.condiciones_pago || '—'}</dd></div>
        <div><dt>Creada por</dt><dd>{order.creado_por_nombre || '—'}</dd></div>
        <div><dt>Aprobada por</dt><dd>{order.aprobado_por_nombre || '—'}</dd></div>
        <div><dt>Valor estimado</dt><dd>{formatMoney(Number(order.valor_estimado))}{order.lineas_sin_precio > 0 && <span className={styles.muted}> ({order.lineas_sin_precio} sin precio)</span>}</dd></div>
      </dl>
      {order.notas && <p className={purchasingStyles.note}>Notas: {order.notas}</p>}
      {order.motivo_cierre && <p className={purchasingStyles.note}><strong>Motivo:</strong> {order.motivo_cierre}</p>}

      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr><th>Material</th><th className={styles.num}>Pedido</th><th className={styles.num}>Recibido</th><th className={styles.num}>Pendiente</th><th className={styles.num}>Precio pactado</th></tr>
          </thead>
          <tbody>
            {order.lineas.map((line) => (
              <tr key={line.id}>
                <td>{line.producto_nombre}</td>
                <td className={styles.num}>{formatQty(line.cantidad_pedida, line.unidad)}</td>
                <td className={styles.num}>{formatQty(line.cantidad_recibida, line.unidad)}</td>
                <td className={styles.num}>{line.completa ? <span className={`${styles.badge} ${styles.badgeOk}`}>Completa</span> : formatQty(line.pendiente, line.unidad)}</td>
                <td className={styles.num}>{line.precio_pactado === null ? '—' : formatMoney(Number(line.precio_pactado))}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className={styles.subhead}>Recepciones</p>
      {order.recepciones.length === 0 ? (
        <p className={styles.muted}>Todavía no se ha recibido mercancía contra esta orden.</p>
      ) : (
        <ul>
          {order.recepciones.map((receipt) => (
            <li key={receipt.id}>{receipt.codigo} · {formatDate(receipt.fecha)} · documento {receipt.documento}</li>
          ))}
        </ul>
      )}
      <div className={styles.actions}>
        <button type="button" className={styles.secondaryBtn} onClick={onClose}>Cerrar</button>
      </div>
    </Modal>
  )
}
