import { useCallback, useEffect, useState } from 'react'
import { apiGet } from '../../api/client'
import styles from '../Inventory/Inventory.module.css'
import finishedStyles from './Finished.module.css'
import { signed } from './finished'

const TYPES = [
  { value: '', label: 'Todos los tipos' },
  { value: 'ENTRADA_PRODUCCION', label: 'Entrada de producción' },
  { value: 'AJUSTE', label: 'Ajuste manual' },
  { value: 'SALIDA_VENTA', label: 'Salida por venta' },
  { value: 'DEVOLUCION_VENTA', label: 'Reingreso por anulación de venta' },
]

const formatMoment = (value) => new Date(value).toLocaleString('es-CO', { dateStyle: 'medium', timeStyle: 'short' })

// Producto terminado · Movimientos: el libro del inventario. Solo se agregan filas: cada una muestra de cuánto a cuánto pasó el
// saldo de una talla y por qué. Es de solo lectura.
export default function MovementsPage() {
  const [rows, setRows] = useState(null)
  const [type, setType] = useState('')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [loadError, setLoadError] = useState('')

  const load = useCallback(() => {
    const params = new URLSearchParams({ limit: '200' })
    if (type) params.set('tipo', type)
    if (from) params.set('desde', from)
    if (to) params.set('hasta', to)
    apiGet(`/api/terminado/movimientos/?${params}`).then((data) => (setRows(data), setLoadError(''))).catch((error) => setLoadError(error.message))
  }, [type, from, to])

  useEffect(() => {
    load()
  }, [load])

  return (
    <div className={styles.page}>
      <header className={styles.pageHeader}>
        <p className={styles.eyebrow}>Producto terminado</p>
        <h1>Movimientos</h1>
        <p className={styles.subtitle}>El historial del inventario final: entradas, ajustes y salidas, con el saldo antes y después de cada uno.</p>
      </header>

      <section className={styles.card}>
        <div className={styles.filters}>
          <select value={type} onChange={(event) => setType(event.target.value)} aria-label="Filtrar por tipo">
            {TYPES.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select>
          <label>Desde <input type="date" value={from} onChange={(event) => setFrom(event.target.value)} /></label>
          <label>Hasta <input type="date" value={to} onChange={(event) => setTo(event.target.value)} /></label>
        </div>
        {loadError && <p className={styles.formError}>{loadError}</p>}
        {rows && rows.length === 0 && <p className={styles.empty}>No hay movimientos con ese filtro.</p>}
        {rows && rows.length > 0 && (
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Fecha</th><th>Tipo</th><th>Referencia</th><th>Talla y color</th><th className={styles.num}>Cantidad</th>
                  <th className={styles.num}>Saldo antes</th><th className={styles.num}>Saldo después</th><th>Origen</th><th>Usuario</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id}>
                    <td>{formatMoment(row.created_at)}</td>
                    <td>{row.tipo_nombre}</td>
                    <td>{row.referencia_nombre}</td>
                    <td>{row.talla} · {row.color}</td>
                    <td className={`${styles.num} ${row.cantidad > 0 ? finishedStyles.up : finishedStyles.down}`}>{signed(row.cantidad)}</td>
                    <td className={styles.num}>{row.saldo_antes}</td>
                    <td className={styles.num}>{row.saldo_despues}</td>
                    <td>{[row.ingreso_codigo, row.ajuste_codigo, row.factura_numero, row.lote_codigo].filter(Boolean).join(' · ') || '—'}</td>
                    <td>{row.usuario_nombre || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  )
}
