import { useState } from 'react'
import LogPager from './LogPager'
import { ACCESS_RESULTS, formatDateTime, resultTone } from './logs'
import useLogList from './useLogList'
import styles from './Security.module.css'

const EVENTS = [
  { value: 'login_ok', label: 'Inicio de sesión' },
  { value: 'login_fallido', label: 'Inicio de sesión fallido' },
  { value: 'cuenta_bloqueada', label: 'Cuenta bloqueada' },
  { value: 'acceso_bloqueado', label: 'Intento con la cuenta bloqueada' },
  { value: 'desbloqueo', label: 'Cuenta desbloqueada' },
  { value: 'registro', label: 'Registro de cuenta' },
]
const EMPTY = { q: '', event: '', result: '', ip: '', date_from: '', date_to: '' }
const TONES = { on: styles.badgeOn, off: styles.badgeOff, warn: styles.badgeWarn }

/** Accesos al sistema (HU 1.5): quién entró, cuándo, desde qué IP y con qué resultado. Solo lectura. */
export default function AccessLogPage() {
  const [filters, setFilters] = useState(EMPTY)
  const { data, loading, error, page, setPage, reload } = useLogList('/api/seguridad/accesos/', filters)
  const setFilter = (name) => (event) => setFilters((current) => ({ ...current, [name]: event.target.value }))

  return (
    <div className={styles.page}>
      <div className={styles.pageHeader}>
        <div>
          <p className={styles.eyebrow}>Seguridad</p>
          <h1 className={styles.title}>Accesos al sistema</h1>
          <p className={styles.subtitle}>
            Inicios de sesión, intentos fallidos y bloqueos de cuenta, con su fecha e IP. Se conservan 12 meses.
          </p>
        </div>
      </div>

      <section className={styles.card}>
        <div className={styles.filtersWide}>
          <input type="search" placeholder="Correo" value={filters.q} onChange={setFilter('q')} aria-label="Correo" />
          <select value={filters.event} onChange={setFilter('event')} aria-label="Filtrar por evento">
            <option value="">Todos los eventos</option>
            {EVENTS.map((e) => (
              <option key={e.value} value={e.value}>
                {e.label}
              </option>
            ))}
          </select>
          <select value={filters.result} onChange={setFilter('result')} aria-label="Filtrar por resultado">
            <option value="">Todos los resultados</option>
            {ACCESS_RESULTS.map((r) => (
              <option key={r.value} value={r.value}>
                {r.label}
              </option>
            ))}
          </select>
          <input type="search" placeholder="IP" value={filters.ip} onChange={setFilter('ip')} aria-label="IP" />
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
                <th>Usuario</th>
                <th>Evento</th>
                <th>Resultado</th>
                <th>IP</th>
              </tr>
            </thead>
            <tbody>
              {data.results.map((row) => (
                <tr key={row.id}>
                  <td>{formatDateTime(row.created_at)}</td>
                  <td>
                    {row.user_name || <span className={styles.muted}>Sin cuenta</span>}
                    <span className={styles.muted}>{row.email}</span>
                  </td>
                  <td>{row.event_label}</td>
                  <td>
                    <span className={`${styles.badge} ${TONES[resultTone(row.result)]}`}>{row.result}</span>
                  </td>
                  <td>{row.ip || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!loading && data.results.length === 0 && !error && (
          <p className={styles.empty}>No hay accesos que coincidan con los filtros.</p>
        )}
        {loading && <p className={styles.empty}>Cargando accesos...</p>}
        <LogPager count={data.count} page={page} setPage={setPage} />
      </section>
    </div>
  )
}
