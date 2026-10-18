import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { apiGet, apiRequest } from '../../api/client'
import { useAuth } from '../../auth/session'
import { fieldErrors } from '../Inventory/labels'
import styles from '../Inventory/Inventory.module.css'
import boardStyles from './Monitor.module.css'
import { formatDuration, liveSeconds } from './lotTracking'
import {
  REFRESH_MS, ageLabel, alertInfo, alertSummary, boardQuery, boardTotal, canDrop, cardButtons, dropOutcome, hiddenCount, moveLot, refreshLabel, targetOfAction,
} from './monitorBoard'

const COLUMN_HINT = {
  PLANEADA: 'Todavía no empiezan.',
  EN_PROCESO: 'Con una etapa corriendo o entre etapas.',
  EN_PAUSA: 'Con la etapa en curso detenida.',
  CANCELADA: 'De órdenes anuladas. Solo consulta.',
}

// Monitor de estado (HU 4.5 / RF15): los lotes en producción en cuatro columnas. El estado de un lote sale de sus etapas, así
// que mover una tarjeta (arrastrándola o con sus botones) pide al servidor la acción que corresponde: iniciar, pausar, reanudar o
// terminar la etapa. El servidor valida; si rechaza la acción, el tablero se recarga y la tarjeta vuelve a su sitio.
export default function MonitorPage() {
  const { can } = useAuth()
  const canManage = can('produccion.gestionar')
  const [board, setBoard] = useState(null)
  const [error, setError] = useState('')
  const [filters, setFilters] = useState({ orden: '', referencia: '', canceladas: false })
  const [orders, setOrders] = useState([])
  const [reloadKey, setReloadKey] = useState(0)
  const [fetchedAt, setFetchedAt] = useState(0)
  const [now, setNow] = useState(0)
  const [dragging, setDragging] = useState(null)
  const [notice, setNotice] = useState('')
  const [busy, setBusy] = useState(false)

  const query = boardQuery(filters)
  const reload = () => setReloadKey((key) => key + 1)

  // Las órdenes alimentan los filtros (la referencia sale de ellas).
  useEffect(() => {
    apiGet('/api/produccion/ordenes/?limit=100').then(setOrders).catch(() => setOrders([]))
  }, [])

  // El tablero se vuelve a pedir al cambiar los filtros, tras una acción y cada `REFRESH_MS`, pero solo si la pestaña se ve.
  useEffect(() => {
    let alive = true
    apiGet(`/api/produccion/monitor/${query}`)
      .then((data) => {
        if (!alive) return
        setBoard(data)
        setError('')
        setFetchedAt(Date.now())
      })
      .catch((failure) => alive && setError(failure.message))
    return () => {
      alive = false
    }
  }, [query, reloadKey])

  useEffect(() => {
    const poll = setInterval(() => document.hidden || setReloadKey((key) => key + 1), REFRESH_MS)
    const onVisible = () => document.hidden || setReloadKey((key) => key + 1)
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      clearInterval(poll)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [])

  useEffect(() => {
    const tick = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(tick)
  }, [])

  const references = useMemo(() => {
    const seen = new Map()
    orders.forEach((order) => seen.set(order.referencia, `${order.referencia_codigo} · ${order.referencia_nombre}`))
    return [...seen.entries()]
  }, [orders])

  const act = async (lot, action) => {
    const target = targetOfAction(lot, action)
    setBusy(true)
    setNotice('')
    if (target) setBoard((current) => ({ ...current, columnas: moveLot(current.columnas, lot.id, target) })) // al instante
    try {
      await apiRequest(`/api/produccion/lotes/${lot.id}/${action}/`, { method: 'POST', body: {} })
      setNotice(`${lot.codigo}: hecho.`)
    } catch (failure) {
      const fields = fieldErrors(failure)
      setNotice(`${lot.codigo}: ${fields.accion ?? fields.orden ?? failure.message}`)
    } finally {
      setBusy(false)
      reload() // con la respuesta del servidor la tarjeta queda donde corresponde, o vuelve a su sitio si fue rechazada
    }
  }

  const drop = (event, column) => {
    event.preventDefault()
    const lot = dragging
    setDragging(null)
    if (!lot || busy) return
    const outcome = dropOutcome(lot, column.estado)
    if (outcome.action) act(lot, outcome.action)
    else if (outcome.reason) setNotice(`${lot.codigo}: ${outcome.reason}`)
  }

  const setFilter = (field) => (event) => setFilters((current) => ({ ...current, [field]: event.target.value }))

  return (
    <div className={styles.page}>
      <header className={styles.pageHeader}>
        <p className={styles.eyebrow}>Producción</p>
        <h1>Monitor de estado</h1>
        <p className={styles.subtitle}>
          Todos los lotes en producción, por estado. Arrastra una tarjeta a otra columna o usa sus botones: el sistema aplica la
          acción de la etapa en curso y valida que el movimiento sea posible.
        </p>
      </header>

      <section className={`${styles.card} ${boardStyles.toolbar}`}>
        <label className={styles.field}>
          Orden
          <select value={filters.orden} onChange={setFilter('orden')} aria-label="Filtrar por orden">
            <option value="">Todas las órdenes</option>
            {orders.map((order) => <option key={order.id} value={order.id}>{order.codigo}</option>)}
          </select>
        </label>
        <label className={styles.field}>
          Referencia
          <select value={filters.referencia} onChange={setFilter('referencia')} aria-label="Filtrar por referencia">
            <option value="">Todas las referencias</option>
            {references.map(([id, label]) => <option key={id} value={id}>{label}</option>)}
          </select>
        </label>
        <label className={boardStyles.check}>
          <input
            type="checkbox" checked={filters.canceladas}
            onChange={(event) => setFilters((current) => ({ ...current, canceladas: event.target.checked }))}
          />
          Ver canceladas
        </label>
        <div className={boardStyles.refresh}>
          <button type="button" className={styles.secondaryBtn} onClick={reload}>Actualizar</button>
          <span className={styles.muted}>{refreshLabel(fetchedAt ? new Date(fetchedAt).toISOString() : null, now || fetchedAt)}</span>
        </div>
      </section>

      {error && <p className={styles.formError} role="alert">{error}</p>}
      {board && alertSummary(board.alertas) && (
        <p className={`${boardStyles.alertBar} ${board.alertas.critica ? boardStyles.alertCritical : boardStyles.alertAttention}`} role="status">
          ⚠ {alertSummary(board.alertas)}: llevan horas detenidos sin movimiento.
        </p>
      )}
      <p className={boardStyles.notice} role="status" aria-live="polite">{notice}</p>
      {!canManage && board && <p className={styles.muted}>Tu rol puede ver el tablero pero no mover los lotes.</p>}

      {board && boardTotal(board.columnas) === 0 && !error && (
        <p className={styles.empty}>
          No hay lotes en producción{filters.orden || filters.referencia ? ' con ese filtro' : ''}. Crea una orden en{' '}
          <Link to="/produccion/ordenes" className={styles.textLink}>Órdenes de producción</Link>.
        </p>
      )}

      <div className={boardStyles.board}>
        {board?.columnas.map((column) => {
          const droppable = dragging && canDrop(dragging, column.estado)
          const dim = dragging && dragging.estado !== column.estado && !droppable
          return (
            <section
              key={column.estado} aria-labelledby={`col-${column.estado}`}
              className={`${boardStyles.column} ${droppable ? boardStyles.dropOk : ''} ${dim ? boardStyles.dim : ''}`}
              onDragOver={(event) => droppable && event.preventDefault()} onDrop={(event) => drop(event, column)}
            >
              <header className={boardStyles.columnHead}>
                <h2 id={`col-${column.estado}`}>{column.nombre}</h2>
                <span className={boardStyles.count}>{column.total}</span>
              </header>
              <p className={styles.muted}>
                {column.estado === 'TERMINADA' ? `Terminados en los últimos ${board.terminadas_dias} días.` : COLUMN_HINT[column.estado]}
              </p>

              {column.lotes.map((lot) => (
                <article
                  key={lot.id}
                  className={`${boardStyles.card} ${dragging?.id === lot.id ? boardStyles.dragging : ''} ${
                    lot.alerta === 'CRITICA' ? boardStyles.cardCritical : lot.alerta === 'ATENCION' ? boardStyles.cardAttention : ''
                  } ${lot.estado === 'CANCELADA' ? boardStyles.cardCancelled : ''}`}
                  draggable={canManage && !busy && lot.estado !== 'TERMINADA' && lot.estado !== 'CANCELADA'}
                  onDragStart={(event) => (event.dataTransfer.setData('text/plain', String(lot.id)), setDragging(lot))}
                  onDragEnd={() => setDragging(null)}
                >
                  <div className={boardStyles.cardTop}>
                    <strong>{lot.codigo}</strong>
                    <span className={styles.muted}>{lot.cantidad} prendas</span>
                  </div>
                  <span className={styles.muted}>{lot.referencia_codigo} · {lot.referencia_nombre}</span>
                  {lot.estado === 'CANCELADA' ? (
                    <span className={styles.muted}>Orden anulada</span>
                  ) : lot.estado === 'TERMINADA' ? (
                    <span>Terminado {ageLabel(lot.ultimo_movimiento, now || fetchedAt)}</span>
                  ) : (
                    <span>
                      <strong>{lot.etapa_actual_nombre}</strong> · etapa {Math.min(lot.etapas_terminadas + 1, lot.etapas_total)} de {lot.etapas_total}
                    </span>
                  )}
                  {alertInfo(lot, fetchedAt, now || fetchedAt) && (
                    <span className={`${boardStyles.alertBadge} ${lot.alerta === 'CRITICA' ? boardStyles.alertCritical : boardStyles.alertAttention}`}>
                      ⚠ {alertInfo(lot, fetchedAt, now || fetchedAt).label}: {alertInfo(lot, fetchedAt, now || fetchedAt).text}
                    </span>
                  )}
                  <div className={boardStyles.cardMeta}>
                    <span title="Tiempo neto: sin contar las pausas">
                      ⏱ {formatDuration(liveSeconds(lot, fetchedAt, now || fetchedAt))}
                    </span>
                    {lot.estado !== 'PLANEADA' && lot.ultimo_movimiento && (
                      <span className={styles.muted}>Último movimiento {ageLabel(lot.ultimo_movimiento, now || fetchedAt)}</span>
                    )}
                    {lot.responsable_nombre && <span className={styles.muted}>{lot.responsable_nombre}</span>}
                    {(lot.operario_nombre || lot.maquina_codigo) && (
                      <span className={styles.muted} title="Operario y máquina de la etapa en curso">
                        👷 {[lot.operario_nombre, lot.maquina_codigo].filter(Boolean).join(' · ')}
                      </span>
                    )}
                  </div>
                  {canManage && (
                    <div className={boardStyles.cardButtons}>
                      {cardButtons(lot).map((button) => (
                        <button
                          key={button.id} type="button" className={button.id === 'completar' ? styles.secondaryBtn : styles.primaryBtn}
                          disabled={busy} onClick={() => act(lot, button.id)} aria-label={`${button.label} ${lot.codigo}`}
                        >
                          {button.symbol} {button.label}
                        </button>
                      ))}
                    </div>
                  )}
                </article>
              ))}

              {column.lotes.length === 0 && <p className={styles.empty}>Sin lotes.</p>}
              {hiddenCount(column) > 0 && (
                <p className={styles.muted}>
                  Mostrando {column.lotes.length} de {column.total}. Filtra por orden o referencia para ver el resto.
                </p>
              )}
            </section>
          )
        })}
      </div>
    </div>
  )
}
