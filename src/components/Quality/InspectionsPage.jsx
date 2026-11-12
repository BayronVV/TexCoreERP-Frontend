import { useCallback, useEffect, useState } from 'react'
import { apiGet } from '../../api/client'
import { useAuth } from '../../auth/session'
import Modal from '../ui/Modal'
import { formatDate } from '../Inventory/labels'
import styles from '../Inventory/Inventory.module.css'
import qualityStyles from './Quality.module.css'
import InspectionForm from './InspectionForm'
import { flawedPercent } from './quality'

/**
 * Detalle de una inspección registrada: resumen y marras por defecto (solo lectura: no se edita ni se borra).
 * @param {{inspection: object, onClose: function()}} props
 */
function InspectionDetail({ inspection, onClose }) {
  return (
    <Modal title={`Inspección ${inspection.codigo}`} onClose={onClose} wide>
      <dl className={qualityStyles.lotInfo}>
        <div><dt>Lote</dt><dd>{inspection.lote_codigo}</dd></div>
        <div><dt>Orden</dt><dd>{inspection.orden_codigo} · {inspection.referencia_nombre}</dd></div>
        <div><dt>Lavandería</dt><dd>{inspection.lavanderia_nombre}</dd></div>
        <div><dt>Fecha</dt><dd>{formatDate(inspection.fecha)}</dd></div>
        <div><dt>Inspector</dt><dd>{inspection.inspector_nombre || '—'}</dd></div>
        <div><dt>Recibidas</dt><dd>{inspection.cantidad_recibida}</dd></div>
        <div><dt>Aptas</dt><dd>{inspection.aptas}</dd></div>
        <div><dt>Marras</dt><dd>{inspection.marras} ({flawedPercent(inspection.marras, inspection.cantidad_recibida)})</dd></div>
      </dl>
      {inspection.detalle.length === 0 ? (
        <p className={styles.empty}>Sin marras: todas las prendas fueron aptas.</p>
      ) : (
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead><tr><th>Defecto</th><th>Tipo</th><th className={styles.num}>Cantidad</th><th>Nota</th></tr></thead>
            <tbody>
              {inspection.detalle.map((row) => (
                <tr key={row.id}>
                  <td>{row.defecto_nombre}</td>
                  <td><span className={`${styles.badge} ${row.corregible ? styles.badgeWarn : styles.badgeDanger}`}>{row.corregible ? 'Corregible' : 'Incorregible'}</span></td>
                  <td className={styles.num}>{row.cantidad}</td>
                  <td className={qualityStyles.noteCell}>{row.nota || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {inspection.observaciones && <p className={qualityStyles.note}>Observaciones: {inspection.observaciones}</p>}
    </Modal>
  )
}

/**
 * Control de calidad · Inspecciones (TE-59), ruta `/calidad/inspecciones` (`calidad.ver`): los lotes que volvieron de lavandería se inspeccionan una sola vez
 * (aptas y marras por defecto) y el historial queda de solo lectura. Registrar exige `calidad.gestionar`. Endpoints: `GET /api/calidad/pendientes/` y `/api/calidad/inspecciones/`.
 */
export default function InspectionsPage() {
  const { can } = useAuth()
  const canManage = can('calidad.gestionar')
  const [pending, setPending] = useState(null)
  const [history, setHistory] = useState(null)
  const [search, setSearch] = useState('')
  const [loadError, setLoadError] = useState('')
  const [inspecting, setInspecting] = useState(null)
  const [viewing, setViewing] = useState(null)

  const loadPending = useCallback(() => {
    apiGet('/api/calidad/pendientes/?limit=200').then((data) => (setPending(data), setLoadError(''))).catch((error) => setLoadError(error.message))
  }, [])

  const loadHistory = useCallback(() => {
    const params = new URLSearchParams({ limit: '200' })
    if (search.trim()) params.set('q', search.trim())
    apiGet(`/api/calidad/inspecciones/?${params}`).then(setHistory).catch((error) => setLoadError(error.message))
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
        <p className={styles.eyebrow}>Control de calidad</p>
        <h1>Inspecciones</h1>
        <p className={styles.subtitle}>
          Revisa cada lote que volvió de lavandería: cuántas prendas son aptas y cuántas marras, y por qué defecto. Las aptas
          más las marras deben sumar exactamente lo recibido, y una inspección no se puede editar después.
        </p>
      </header>

      {loadError && <p className={styles.formError}>{loadError}</p>}

      <section className={styles.card}>
        <h2 className={styles.cardTitle}>Lotes por inspeccionar</h2>
        {pending && pending.length === 0 && <p className={styles.empty}>No hay lotes pendientes. Aparecen aquí cuando se recibe una remisión de lavandería.</p>}
        {pending && pending.length > 0 && (
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr><th>Lote</th><th>Orden</th><th>Referencia</th><th>Lavandería</th><th>Recepción</th><th className={styles.num}>Recibidas</th><th /></tr>
              </thead>
              <tbody>
                {pending.map((lot) => (
                  <tr key={lot.id}>
                    <td><strong>{lot.codigo}</strong></td>
                    <td>{lot.orden_codigo}</td>
                    <td>{lot.referencia_nombre}</td>
                    <td>{lot.lavanderia_nombre}</td>
                    <td>{lot.recepcion_codigo} · {formatDate(lot.fecha_recepcion)}</td>
                    <td className={styles.num}>{lot.cantidad_recibida}</td>
                    <td>
                      {canManage
                        ? <button type="button" className={styles.linkBtn} onClick={() => setInspecting(lot)}>Inspeccionar</button>
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
        <h2 className={styles.cardTitle}>Inspecciones registradas</h2>
        <div className={styles.filters}>
          <input type="search" placeholder="Buscar por inspección, lote u orden" value={search} onChange={(event) => setSearch(event.target.value)} aria-label="Buscar inspecciones" />
        </div>
        {history && history.length === 0 && <p className={styles.empty}>{search ? 'Ninguna inspección coincide con la búsqueda.' : 'Todavía no hay inspecciones registradas.'}</p>}
        {history && history.length > 0 && (
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Inspección</th><th>Lote</th><th>Referencia</th><th>Fecha</th><th className={styles.num}>Recibidas</th>
                  <th className={styles.num}>Aptas</th><th className={styles.num}>Marras</th><th className={styles.num}>% marras</th><th>Inspector</th><th />
                </tr>
              </thead>
              <tbody>
                {history.map((item) => (
                  <tr key={item.id}>
                    <td><strong>{item.codigo}</strong></td>
                    <td>{item.lote_codigo}</td>
                    <td>{item.referencia_nombre}</td>
                    <td>{formatDate(item.fecha)}</td>
                    <td className={styles.num}>{item.cantidad_recibida}</td>
                    <td className={styles.num}>{item.aptas}</td>
                    <td className={styles.num}>{item.marras}</td>
                    <td className={styles.num}>{flawedPercent(item.marras, item.cantidad_recibida)}</td>
                    <td>{item.inspector_nombre || '—'}</td>
                    <td><button type="button" className={styles.linkBtn} onClick={() => setViewing(item)}>Ver</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {inspecting && (
        <InspectionForm
          lot={inspecting} onClose={() => setInspecting(null)}
          onSaved={() => { setInspecting(null); loadPending(); loadHistory() }}
        />
      )}
      {viewing && <InspectionDetail inspection={viewing} onClose={() => setViewing(null)} />}
    </div>
  )
}
