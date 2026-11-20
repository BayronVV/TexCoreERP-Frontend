import { Link } from 'react-router-dom'
import Modal from '../ui/Modal'
import { formatDate, formatQty } from '../Inventory/labels'
import { formatMoney } from '../Inventory/money'
import styles from '../Inventory/Inventory.module.css'
import purchasingStyles from './Purchasing.module.css'
import { STATE_TONE, buildOrderHistory, orderProgress } from './purchasing'

function formatEventDate(value) {
  if (!value) return '—'
  if (!value.includes('T')) return formatDate(value)
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return value
  return parsed.toLocaleString('es-CO', { dateStyle: 'medium', timeStyle: 'short' })
}

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

// Consulta de una orden: datos, historial de quién hizo cada paso, líneas con lo recibido y lo pendiente, y sus ingresos.
export default function OrderDetail({ order, onClose }) {
  const history = buildOrderHistory(order)
  const entries = Array.isArray(order.ingresos) && order.ingresos.length > 0
    ? order.ingresos
    : (order.recepciones ?? []).flatMap((receipt) =>
        (receipt.lineas ?? []).map((line) => ({
          id: line.id,
          recepcion_codigo: receipt.codigo,
          fecha: receipt.fecha,
          documento: receipt.documento,
          producto_nombre: line.producto_nombre,
          unidad: line.unidad,
          cantidad: line.cantidad,
          lote: line.lote,
          costo_unitario: line.costo_unitario,
          recibido_por_nombre: receipt.recibido_por_nombre,
        })),
      )

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

      <p className={styles.subhead}>Historial de la orden</p>
      <ul className={purchasingStyles.historyList}>
        {history.map((item, index) => (
          <li key={`${item.evento}-${index}`} className={purchasingStyles.historyItem}>
            <div>
              <strong>{item.titulo}</strong>
              {item.detalle && <span className={styles.muted}> · {item.detalle}</span>}
            </div>
            <div className={styles.muted}>
              {item.usuario || 'Sistema'} · {formatEventDate(item.fecha)}
            </div>
          </li>
        ))}
      </ul>

      <p className={styles.subhead}>Recepciones e ingresos de inventario</p>
      {entries.length === 0 ? (
        order.recepciones.length === 0 ? (
          <p className={styles.muted}>Todavía no se ha recibido mercancía contra esta orden.</p>
        ) : (
          <ul>
            {order.recepciones.map((receipt) => (
              <li key={receipt.id}>
                {receipt.codigo} · {formatDate(receipt.fecha)} · documento {receipt.documento}
                {receipt.recibido_por_nombre ? ` · ${receipt.recibido_por_nombre}` : ''}
              </li>
            ))}
          </ul>
        )
      ) : (
        <>
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr><th>Recepción</th><th>Fecha</th><th>Documento</th><th>Material</th><th className={styles.num}>Cantidad</th><th>Lote</th><th className={styles.num}>Costo unit.</th><th>Recibió</th></tr>
              </thead>
              <tbody>
                {entries.map((entry) => (
                  <tr key={entry.id}>
                    <td><strong>{entry.recepcion_codigo}</strong></td>
                    <td>{formatDate(entry.fecha)}</td>
                    <td>{entry.documento}</td>
                    <td>{entry.producto_nombre}</td>
                    <td className={styles.num}>{formatQty(entry.cantidad, entry.unidad)}</td>
                    <td>{entry.lote}</td>
                    <td className={styles.num}>{entry.costo_unitario ? formatMoney(Number(entry.costo_unitario)) : '—'}</td>
                    <td>{entry.recibido_por_nombre || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className={purchasingStyles.note}>
            <Link className={styles.textLink} to={`/inventario?tab=historial&vista=kardex&orden_compra=${encodeURIComponent(order.codigo)}`}>
              Ver ingresos de {order.codigo} en el Kardex de inventario
            </Link>
          </p>
        </>
      )}
      <div className={styles.actions}>
        <button type="button" className={styles.secondaryBtn} onClick={onClose}>Cerrar</button>
      </div>
    </Modal>
  )
}
