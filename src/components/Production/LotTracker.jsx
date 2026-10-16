import { useEffect, useState } from 'react'
import { apiGet, apiRequest } from '../../api/client'
import { fieldErrors } from '../Inventory/labels'
import styles from '../Inventory/Inventory.module.css'
import trackStyles from './Production.module.css'
import { buttonsFor, formatDuration, isRunning, liveSeconds, lotLiveSeconds, stageProgress } from './lotTracking'

const STATE_BADGE = {
  PLANEADA: styles.badgeOff, EN_PROCESO: styles.badgeInfo, EN_PAUSA: styles.badgeWarn, TERMINADA: styles.badgeOk, CANCELADA: styles.badgeDanger,
}
const STAGE_BADGE = { PENDIENTE: styles.badgeOff, EN_PROCESO: styles.badgeInfo, PAUSADA: styles.badgeWarn, COMPLETADA: styles.badgeOk }

/** Insignia con el estado de un lote o de una orden (planeada, en proceso, en pausa, terminada o cancelada). */
export function StateBadge({ state, name }) {
  return <span className={`${styles.badge} ${STATE_BADGE[state] ?? ''}`}>{name}</span>
}

// Hora actual en milisegundos; arranca en `start` (cuando llegaron los datos) y se refresca cada segundo solo mientras `active`
// (hay una etapa corriendo). Las etapas que no corren no dependen de ella.
function useNow(active, start) {
  const [now, setNow] = useState(start)
  useEffect(() => {
    if (!active) return undefined
    const timer = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(timer)
  }, [active])
  return now
}

const formatMoment = (value) =>
  new Date(value).toLocaleString('es-CO', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })

// Seguimiento de los lotes de una orden (HU 4.3 / RF13): Play, Pausa y Stop por lote, con el estado y el tiempo neto de cada
// etapa. Cada acción la valida el servidor; al responder, el lote se actualiza en pantalla (`onChange`).
export default function LotTracker({ order, canManage, fetchedAt, onChange }) {
  const [busy, setBusy] = useState(null)
  const [errors, setErrors] = useState({})
  const [history, setHistory] = useState({}) // lote → eventos (si se abrió el historial)
  const now = useNow(order.lotes.some(isRunning), fetchedAt)

  const act = async (lot, action) => {
    setBusy(lot.id)
    setErrors((current) => ({ ...current, [lot.id]: '' }))
    try {
      const updated = await apiRequest(`/api/produccion/lotes/${lot.id}/${action}/`, { method: 'POST', body: {} })
      onChange(updated)
      if (history[lot.id]) await loadHistory(lot.id)
    } catch (error) {
      const fields = fieldErrors(error)
      setErrors((current) => ({ ...current, [lot.id]: fields.accion ?? fields.orden ?? error.message }))
    } finally {
      setBusy(null)
    }
  }

  const loadHistory = (lotId) =>
    apiGet(`/api/produccion/lotes/${lotId}/historial/`).then((events) => setHistory((current) => ({ ...current, [lotId]: events })))

  const toggleHistory = (lot) => {
    if (history[lot.id]) return setHistory((current) => ({ ...current, [lot.id]: undefined }))
    loadHistory(lot.id).catch((error) => setErrors((current) => ({ ...current, [lot.id]: error.message })))
  }

  return (
    <div className={trackStyles.tracker}>
      {order.lotes.map((lot) => {
        const buttons = buttonsFor(lot.acciones)
        const play = buttons.find((b) => b.id === 'reanudar' && b.enabled) ?? buttons.find((b) => b.id === 'iniciar')
        const shown = [play, buttons.find((b) => b.id === 'pausar'), buttons.find((b) => b.id === 'completar')]
        const progress = stageProgress(lot)
        const events = history[lot.id]
        return (
          <article key={lot.id} className={trackStyles.trackLot}>
            <header className={trackStyles.trackHead}>
              <strong>{lot.codigo}</strong>
              <span className={styles.muted}>{lot.cantidad} prendas</span>
              <StateBadge state={lot.estado} name={lot.estado_nombre} />
              <span className={styles.muted}>{progress.done} de {progress.total} etapas</span>
              <span className={trackStyles.trackTime} title="Tiempo neto: sin contar las pausas">
                {formatDuration(lotLiveSeconds(lot, fetchedAt, now))}
              </span>
            </header>

            <div className={trackStyles.stageChips}>
              {lot.etapas.map((stage) => (
                <span key={stage.id} className={`${trackStyles.chip} ${stage.etapa === lot.etapa_actual ? trackStyles.chipCurrent : ''}`}>
                  <span>{stage.etapa_nombre}</span>
                  <span className={`${styles.badge} ${STAGE_BADGE[stage.estado] ?? ''}`}>{stage.estado_nombre}</span>
                  {stage.estado !== 'PENDIENTE' && <small>{formatDuration(liveSeconds(stage, fetchedAt, now))}</small>}
                </span>
              ))}
            </div>

            <div className={trackStyles.trackButtons}>
              {shown.map((button) => (
                <button
                  key={button.id} type="button" className={button.id === 'completar' ? styles.secondaryBtn : styles.primaryBtn}
                  disabled={!canManage || !button.enabled || busy !== null} onClick={() => act(lot, button.id)}
                  aria-label={`${button.label} ${lot.codigo}`}
                >
                  {button.symbol} {button.label}
                </button>
              ))}
              <button type="button" className={styles.linkBtn} onClick={() => toggleHistory(lot)}>
                {events ? 'Ocultar historial' : 'Historial'}
              </button>
              {!canManage && <span className={styles.muted}>Tu rol puede ver los tiempos pero no controlarlos.</span>}
            </div>
            {errors[lot.id] && <span className={styles.fieldError} role="alert">{errors[lot.id]}</span>}

            {events && (
              events.length === 0 ? (
                <p className={styles.muted}>Todavía no hay registros de tiempo en este lote.</p>
              ) : (
                <ul className={trackStyles.history}>
                  {events.map((event) => (
                    <li key={event.id}>
                      {formatMoment(event.momento)} · <strong>{event.etapa_nombre}</strong> · {event.accion_nombre} · {event.usuario_nombre}
                      {event.nota && <span className={styles.muted}> — {event.nota}</span>}
                    </li>
                  ))}
                </ul>
              )
            )}
          </article>
        )
      })}
    </div>
  )
}
