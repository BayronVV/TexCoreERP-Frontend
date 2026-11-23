import { useEffect, useState } from 'react'
import { apiGet } from '../../api/client'
import LogPager from './LogPager'
import { actionLabel, AUDIT_RESULTS, formatDateTime, resultTone } from './logs'
import useLogList from './useLogList'
import styles from './Security.module.css'

const EMPTY = { action: '', entity: '', entity_id: '', result: '', date_from: '', date_to: '' }
const TONES = { on: styles.badgeOn, off: styles.badgeOff, warn: styles.badgeWarn }
const RESULT_LABEL = Object.fromEntries(AUDIT_RESULTS.map((r) => [r.value, r.label]))

function AuditRow({ row, open, onToggle }) {
  const { datos, motivo } = row.detail ?? {}
  return (
    <>
      <tr>
        <td>{formatDateTime(row.created_at)}</td>
        <td>
          {row.user_name || '—'}
          {row.ip && <span className={styles.muted}>{row.ip}</span>}
        </td>
        <td>{actionLabel(row.action)}</td>
        <td>
          {row.entity ? row.entity.replaceAll('_', ' ') : '—'}
          {row.entity_id && <span className={styles.muted}>#{row.entity_id}</span>}
        </td>
        <td>
          <span className={`${styles.badge} ${TONES[resultTone(row.result)]}`}>
            {RESULT_LABEL[row.result] ?? row.result}
          </span>
        </td>
        <td>
          <button type="button" className={styles.linkBtn} onClick={onToggle} aria-expanded={open}>
            {open ? 'Ocultar' : 'Detalle'}
          </button>
        </td>
      </tr>
      {open && (
        <tr>
          <td colSpan={6}>
            {motivo && <p className={styles.muted}>Motivo: {motivo}</p>}
            <pre className={styles.detailBox}>{JSON.stringify(datos ?? {}, null, 2)}</pre>
          </td>
        </tr>
      )}
    </>
  )
}

/** Auditoría de operaciones críticas (HU 1.5): autor, fecha, operación, entidad y resultado. Solo lectura. */
export default function AuditPage() {
  const [filters, setFilters] = useState(EMPTY)
  const [catalog, setCatalog] = useState({ actions: [], entities: [] })
  const [openId, setOpenId] = useState(null)
  const { data, loading, error, page, setPage, reload } = useLogList('/api/seguridad/auditoria/', filters)
  const setFilter = (name) => (event) => setFilters((current) => ({ ...current, [name]: event.target.value }))

  useEffect(() => {
    apiGet('/api/seguridad/auditoria/catalogo/')
      .then(setCatalog)
      .catch(() => {})
  }, [])

  return (
    <div className={styles.page}>
      <div className={styles.pageHeader}>
        <div>
          <p className={styles.eyebrow}>Seguridad</p>
          <h1 className={styles.title}>Auditoría de operaciones</h1>
          <p className={styles.subtitle}>
            Quién hizo cada operación crítica, sobre qué y con qué resultado, incluidos los intentos rechazados por
            falta de permiso. El registro no se edita ni se borra y se conserva 12 meses.
          </p>
        </div>
      </div>

      <section className={styles.card}>
        <div className={styles.filtersWide}>
          <select value={filters.action} onChange={setFilter('action')} aria-label="Filtrar por operación">
            <option value="">Todas las operaciones</option>
            {catalog.actions.map((a) => (
              <option key={a} value={a}>
                {a.endsWith('.*') ? `${actionLabel(a.slice(0, -2))} (todas)` : actionLabel(a)}
              </option>
            ))}
          </select>
          <select value={filters.entity} onChange={setFilter('entity')} aria-label="Filtrar por entidad">
            <option value="">Todas las entidades</option>
            {catalog.entities.map((e) => (
              <option key={e} value={e}>
                {e.replaceAll('_', ' ')}
              </option>
            ))}
          </select>
          <input
            type="search"
            placeholder="Id de la entidad"
            value={filters.entity_id}
            onChange={setFilter('entity_id')}
            aria-label="Id de la entidad"
          />
          <select value={filters.result} onChange={setFilter('result')} aria-label="Filtrar por resultado">
            <option value="">Todos los resultados</option>
            {AUDIT_RESULTS.map((r) => (
              <option key={r.value} value={r.value}>
                {r.label}
              </option>
            ))}
          </select>
          <label className={styles.dateField}>
            Desde
            <input type="date" value={filters.date_from} onChange={setFilter('date_from')} />
          </label>
          <label className={styles.dateField}>
            Hasta
            <input type="date" value={filters.date_to} onChange={setFilter('date_to')} />
          </label>
        </div>

        {error && (
          <p className={styles.formError}>
            {error}{' '}
            <button type="button" className={styles.linkBtn} onClick={reload}>
              Reintentar
            </button>
          </p>
        )}
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Autor</th>
                <th>Operación</th>
                <th>Afectado</th>
                <th>Resultado</th>
                <th aria-label="Detalle" />
              </tr>
            </thead>
            <tbody>
              {data.results.map((row) => (
                <AuditRow
                  key={row.id}
                  row={row}
                  open={openId === row.id}
                  onToggle={() => setOpenId(openId === row.id ? null : row.id)}
                />
              ))}
            </tbody>
          </table>
        </div>
        {!loading && data.results.length === 0 && !error && (
          <p className={styles.empty}>No hay operaciones que coincidan con los filtros.</p>
        )}
        {loading && <p className={styles.empty}>Cargando auditoría...</p>}
        <LogPager count={data.count} page={page} setPage={setPage} />
      </section>
    </div>
  )
}
