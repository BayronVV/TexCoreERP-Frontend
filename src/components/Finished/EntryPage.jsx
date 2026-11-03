import { useCallback, useEffect, useState } from 'react'
import { apiGet } from '../../api/client'
import { useAuth } from '../../auth/session'
import Modal from '../ui/Modal'
import { formatDate } from '../Inventory/labels'
import styles from '../Inventory/Inventory.module.css'
import finishedStyles from './Finished.module.css'
import EntryForm from './EntryForm'
import { differenceLabel, variantLabel } from './finished'

// Detalle de un ingreso registrado: reparto por talla frente a lo planificado (solo lectura: no se edita ni se borra).
function EntryDetail({ entry, onClose }) {
  return (
    <Modal title={`Ingreso ${entry.codigo}`} onClose={onClose} wide>
      <dl className={finishedStyles.lotInfo}>
        <div><dt>Inspección</dt><dd>{entry.inspeccion_codigo}</dd></div>
        <div><dt>Lote</dt><dd>{entry.lote_codigo} · {entry.orden_codigo}</dd></div>
        <div><dt>Referencia</dt><dd>{entry.referencia_nombre}</dd></div>
        <div><dt>Fecha</dt><dd>{formatDate(entry.fecha)}</dd></div>
        <div><dt>Ingresó</dt><dd>{entry.recibido_por_nombre || '—'}</dd></div>
        <div><dt>Ubicación</dt><dd>{entry.ubicacion || '—'}</dd></div>
        <div><dt>Aptas ingresadas</dt><dd>{entry.aptas}</dd></div>
      </dl>
      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead><tr><th>Talla y color</th><th className={styles.num}>Ingresadas</th><th className={styles.num}>Planificadas</th><th className={styles.num}>Diferencia</th></tr></thead>
          <tbody>
            {entry.lineas.map((line) => (
              <tr key={line.id}>
                <td>{variantLabel(line)}</td>
                <td className={styles.num}>{line.cantidad}</td>
                <td className={styles.num}>{line.planificada ?? '—'}</td>
                <td className={styles.num}>{differenceLabel(line)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {entry.observaciones && <p className={finishedStyles.note}>Observaciones: {entry.observaciones}</p>}
    </Modal>
  )
}

// Producto terminado · Ingreso: las inspecciones con aptas que todavía no entran al inventario final se reparten por talla y
// color. Ingresar exige `producto_terminado.gestionar` (Secretaria y Administrador); consultar, `producto_terminado.ver`.
export default function EntryPage() {
  const { can } = useAuth()
  const canManage = can('producto_terminado.gestionar')
  const [pending, setPending] = useState(null)
  const [history, setHistory] = useState(null)
  const [search, setSearch] = useState('')
  const [loadError, setLoadError] = useState('')
  const [entering, setEntering] = useState(null)
  const [viewing, setViewing] = useState(null)

  const loadPending = useCallback(() => {
    apiGet('/api/terminado/pendientes/?limit=200').then((data) => (setPending(data), setLoadError(''))).catch((error) => setLoadError(error.message))
  }, [])

  const loadHistory = useCallback(() => {
    const params = new URLSearchParams({ limit: '200' })
    if (search.trim()) params.set('q', search.trim())
    apiGet(`/api/terminado/ingresos/?${params}`).then(setHistory).catch((error) => setLoadError(error.message))
  }, [search])

  useEffect(() => {
    const timer = setTimeout(loadHistory, 250)
    return () => clearTimeout(timer)
  }, [loadHistory])

  useEffect(() => {
    loadPending()
  }, [loadPending])

  return (
    <div className={styles.page}>
      <header className={styles.pageHeader}>
        <p className={styles.eyebrow}>Producto terminado</p>
        <h1>Ingreso al inventario final</h1>
        <p className={styles.subtitle}>
          Las prendas aptas de cada inspección entran al inventario por talla y color. El reparto debe sumar exactamente las aptas, y un
          ingreso no se puede editar después. Las marras no entran a este inventario.
        </p>
      </header>

      {loadError && <p className={styles.formError}>{loadError}</p>}

      <section className={styles.card}>
        <h2 className={styles.cardTitle}>Inspecciones por ingresar</h2>
        {pending && pending.length === 0 && <p className={styles.empty}>No hay inspecciones pendientes. Aparecen aquí cuando Control de Calidad inspecciona un lote.</p>}
        {pending && pending.length > 0 && (
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr><th>Inspección</th><th>Lote</th><th>Orden</th><th>Referencia</th><th>Fecha</th><th className={styles.num}>Aptas</th><th className={styles.num}>Marras</th><th /></tr>
              </thead>
              <tbody>
                {pending.map((item) => (
                  <tr key={item.inspeccion}>
                    <td><strong>{item.inspeccion_codigo}</strong></td>
                    <td>{item.lote_codigo}</td>
                    <td>{item.orden_codigo}</td>
                    <td>{item.referencia_nombre}</td>
                    <td>{formatDate(item.fecha)}</td>
                    <td className={styles.num}>{item.aptas}</td>
                    <td className={styles.num}>{item.marras}</td>
                    <td>
                      {canManage
                        ? <button type="button" className={styles.linkBtn} onClick={() => setEntering(item)}>Ingresar</button>
                        : <span className={styles.muted}>Solo consulta</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className={styles.card}>
        <h2 className={styles.cardTitle}>Ingresos registrados</h2>
        <div className={styles.filters}>
          <input type="search" placeholder="Buscar por ingreso, inspección o lote" value={search} onChange={(event) => setSearch(event.target.value)} aria-label="Buscar ingresos" />
        </div>
        {history && history.length === 0 && <p className={styles.empty}>{search ? 'Ningún ingreso coincide con la búsqueda.' : 'Todavía no hay ingresos registrados.'}</p>}
        {history && history.length > 0 && (
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr><th>Ingreso</th><th>Lote</th><th>Referencia</th><th>Fecha</th><th className={styles.num}>Aptas</th><th>Ubicación</th><th>Ingresó</th><th /></tr>
              </thead>
              <tbody>
                {history.map((item) => (
                  <tr key={item.id}>
                    <td><strong>{item.codigo}</strong></td>
                    <td>{item.lote_codigo}</td>
                    <td>{item.referencia_nombre}</td>
                    <td>{formatDate(item.fecha)}</td>
                    <td className={styles.num}>{item.aptas}</td>
                    <td>{item.ubicacion || '—'}</td>
                    <td>{item.recibido_por_nombre || '—'}</td>
                    <td><button type="button" className={styles.linkBtn} onClick={() => setViewing(item)}>Ver</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {entering && (
        <EntryForm pending={entering} onClose={() => setEntering(null)} onSaved={() => { setEntering(null); loadPending(); loadHistory() }} />
      )}
      {viewing && <EntryDetail entry={viewing} onClose={() => setViewing(null)} />}
    </div>
  )
}
