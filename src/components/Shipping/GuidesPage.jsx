import { useCallback, useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { apiGet, apiRequest } from '../../api/client'
import { useAuth } from '../../auth/session'
import { useToast } from '../ui/toastContext'
import Modal from '../ui/Modal'
import { fieldErrors } from '../Inventory/labels'
import styles from '../Inventory/Inventory.module.css'
import finishedStyles from '../Finished/Finished.module.css'
import shipStyles from './Shipping.module.css'
import GuideBadge from './GuideBadge'
import {
  agoText, canRegisterReturn, canTrack, cooldownText, minimumNote, money, noteProblem, quotaLow, quotaText, requiresNote, stateConfirmation,
  stateName, trackingMessage,
} from './shipping'

const formatMoment = (value) => (value ? new Date(value).toLocaleString('es-CO', { dateStyle: 'medium', timeStyle: 'short' }) : '—')

const ORIGINS = { MANUAL: 'Manual', TRACK123: 'Rastreo', SISTEMA: 'Sistema' }

/**
 * Detalle de una guía: datos, historial propio, línea de tiempo de la transportadora (ya guardada: verla no llama a la API de rastreo) y las
 * acciones (con `envios.gestionar`: cambiar estado, ajustar flete, rastrear; con `envios.devolucion`: registrar la devolución). Consultar a la
 * transportadora gasta cuota, por eso solo ocurre cuando el usuario pulsa «Consultar estado».
 * Endpoints: `/api/envios/guias/:id/` (y `estado/`, `flete/`, `devolucion/`, `rastrear/`) y `GET /api/envios/rastreo/estado/`.
 * @param {object} props
 * @param {number} props.guideId Id de la guía.
 * @param {object} props.meta Metadatos de `/api/envios/metadatos/`.
 * @param {function()} props.onChanged Se llama cuando la guía cambió, para recargar la lista.
 * @param {function()} props.onClose Cierra el detalle.
 */
function GuideDetail({ guideId, meta, onChanged, onClose }) {
  const { can } = useAuth()
  const notify = useToast()
  const [guide, setGuide] = useState(null)
  const [quota, setQuota] = useState(null)
  const [loadError, setLoadError] = useState('')
  const [target, setTarget] = useState('')
  const [note, setNote] = useState('')
  const [freight, setFreight] = useState('')
  const [error, setError] = useState('')
  const [trackInfo, setTrackInfo] = useState('')
  const [busy, setBusy] = useState(false)
  const [now, setNow] = useState(0) // el momento de la última carga, para calcular el enfriamiento sin llamar a Date.now() al dibujar
  const canManage = can('envios.gestionar')

  const loadQuota = useCallback(() => {
    if (canManage) apiGet('/api/envios/rastreo/estado/').then(setQuota).catch(() => {})
  }, [canManage])

  useEffect(() => {
    apiGet(`/api/envios/guias/${guideId}/`)
      .then((data) => {
        setGuide(data)
        setNow(Date.now())
        setFreight(data.valor_flete ? String(data.valor_flete) : '')
      })
      .catch((failure) => setLoadError(failure.message))
    loadQuota()
  }, [guideId, loadQuota])

  const apply = (data) => {
    setGuide(data)
    setNow(Date.now())
    setFreight(data.valor_flete ? String(data.valor_flete) : '')
    onChanged()
  }

  const changeState = async (event) => {
    event.preventDefault()
    const problem = noteProblem(target, note, meta)
    if (problem) return setError(problem)
    if (!window.confirm(stateConfirmation(guide, target, meta))) return
    setBusy(true)
    setError('')
    try {
      const saved = await apiRequest(`/api/envios/guias/${guide.id}/estado/`, { method: 'POST', body: { estado: target, nota: note.trim() } })
      notify(`Guía ${saved.numero_guia || `#${saved.id}`}: ahora está «${saved.estado_nombre}».`)
      apply(saved)
      setTarget('')
      setNote('')
    } catch (failure) {
      const errors = fieldErrors(failure)
      setError(errors.nota ?? errors.estado ?? errors.detail ?? failure.message)
    } finally {
      setBusy(false)
    }
  }

  const saveFreight = async (event) => {
    event.preventDefault()
    if (!/^\d+$/.test(freight.trim())) return setError('El flete debe ser un valor entero en pesos.')
    setBusy(true)
    setError('')
    try {
      const saved = await apiRequest(`/api/envios/guias/${guide.id}/flete/`, { method: 'PATCH', body: { valor_flete: Number(freight.trim()) } })
      notify(`Flete registrado: ${money(saved.valor_flete)}.`)
      apply({ ...guide, ...saved })
    } catch (failure) {
      const errors = fieldErrors(failure)
      setError(errors.valor_flete ?? errors.detail ?? failure.message)
    } finally {
      setBusy(false)
    }
  }

  const registerReturn = async () => {
    if (!window.confirm(`¿Registrar en cartera la devolución de la factura ${guide.factura_numero}? Las prendas vuelven al inventario una sola vez y no se puede deshacer.`)) return
    setBusy(true)
    setError('')
    try {
      await apiRequest(`/api/envios/guias/${guide.id}/devolucion/`, { method: 'POST' })
      notify(`Devolución de ${guide.factura_numero} registrada en cartera.`)
      const fresh = await apiGet(`/api/envios/guias/${guide.id}/`)
      apply(fresh)
    } catch (failure) {
      setError(fieldErrors(failure).detail ?? failure.message)
    } finally {
      setBusy(false)
    }
  }

  // Única llamada a la transportadora: la dispara el clic. Un 429, 503 o 400 no es un error fatal: se muestra el mensaje y la guía no cambia.
  const track = async () => {
    setBusy(true)
    setError('')
    setTrackInfo('')
    try {
      const { aviso, ...data } = await apiRequest(`/api/envios/guias/${guide.id}/rastrear/`, { method: 'POST', body: {} })
      apply({ ...guide, ...data })
      setTrackInfo(aviso || 'Estado consultado en la transportadora.')
    } catch (failure) {
      const friendly = trackingMessage(failure)
      if (friendly) setTrackInfo(friendly)
      else setError(failure.message)
    } finally {
      setBusy(false)
      loadQuota()
    }
  }

  if (loadError) {
    return (
      <Modal title="Guía" onClose={onClose}>
        <p className={styles.formError}>{loadError}</p>
      </Modal>
    )
  }
  if (!guide) {
    return (
      <Modal title="Guía" onClose={onClose}>
        <p className={styles.muted}>Cargando…</p>
      </Modal>
    )
  }

  const tracking = guide.rastreo ?? {}
  const nextSeconds = tracking.proxima_consulta ? Math.ceil((new Date(tracking.proxima_consulta).getTime() - now) / 1000) : 0
  const quotaMessage = quotaText(quota)
  const needsNote = requiresNote(target, meta)

  return (
    <Modal title={`Guía ${guide.numero_guia || `#${guide.id}`} · ${guide.factura_numero}`} onClose={onClose} wide>
      <p><GuideBadge color={guide.color} name={guide.estado_nombre} />{!guide.vigente && <span className={styles.muted}> · Guía reemplazada (no vigente)</span>}</p>
      {guide.aviso_formato && <p className={shipStyles.warning} role="note">{guide.aviso_formato}</p>}
      {guide.novedad && <p className={shipStyles.warning} role="note">Novedad: {guide.novedad}</p>}

      <dl className={finishedStyles.lotInfo}>
        <div><dt>Cliente</dt><dd>{guide.cliente_nombre} · {guide.cliente_ciudad}</dd></div>
        <div><dt>Vendedor</dt><dd>{guide.vendedor_nombre || '—'}</dd></div>
        <div><dt>Transportadora</dt><dd>{guide.transportadora_nombre}</dd></div>
        <div><dt>Factura</dt><dd>{guide.factura_numero} · {money(guide.factura_total)}</dd></div>
        <div><dt>Flete</dt><dd>{guide.valor_flete ? money(guide.valor_flete) : 'Sin registrar'}</dd></div>
        <div><dt>Relación de despacho</dt><dd>{guide.relacion_codigo || '—'}</dd></div>
        <div><dt>Despachada</dt><dd>{formatMoment(guide.despachada_en)}</dd></div>
        <div><dt>Entregada</dt><dd>{formatMoment(guide.entregada_en)}</dd></div>
        {guide.devuelta_en && <div><dt>Devuelta</dt><dd>{formatMoment(guide.devuelta_en)}</dd></div>}
      </dl>

      {tracking.soportado && (
        <section aria-label="Rastreo en la transportadora">
          <h3 className={shipStyles.sectionTitle}>Rastreo en la transportadora</h3>
          {tracking.sintetico && <p className={shipStyles.demo} role="note">Datos de demostración (no vienen de la transportadora)</p>}
          <p className={styles.muted}>
            {tracking.registrado
              ? <>Último estado: <strong>{tracking.descripcion || tracking.estado || '—'}</strong> · última consulta {agoText(tracking.consultado_en, now)}</>
              : 'Esta guía todavía no se ha consultado en la transportadora.'}
          </p>
          {canTrack(guide, canManage) && (
            <div className={shipStyles.trackBar}>
              <button type="button" className={styles.secondaryBtn} onClick={track} disabled={busy}>
                {busy ? 'Consultando…' : 'Consultar estado'}
              </button>
              {quotaMessage && <span className={`${shipStyles.quota} ${quotaLow(quota) ? shipStyles.quotaLow : ''}`}>{quotaMessage}</span>}
              {nextSeconds > 0 && <span className={shipStyles.quota}>{cooldownText(nextSeconds)}</span>}
            </div>
          )}
          {canManage && quota && quota.habilitado === false && <p className={shipStyles.info}>{quota.mensaje || 'El rastreo está apagado.'}</p>}
          {canManage && quota && quota.habilitado !== false && quotaLow(quota) && quota.mensaje && <p className={shipStyles.warning}>{quota.mensaje}</p>}
          {trackInfo && <p className={shipStyles.info} role="status">{trackInfo}</p>}
        </section>
      )}

      <div className={shipStyles.columns}>
        <section aria-label="Historial propio">
          <h3 className={shipStyles.sectionTitle}>Historial de la guía</h3>
          {(guide.eventos ?? []).length === 0 && <p className={styles.muted}>Sin movimientos.</p>}
          <ol className={shipStyles.timeline}>
            {(guide.eventos ?? []).map((event) => (
              <li key={event.id}>
                <strong>{event.estado_antes_nombre ? `${event.estado_antes_nombre} → ` : ''}{event.estado_despues_nombre}</strong>
                {event.nota && <div>{event.nota}</div>}
                <small>{formatMoment(event.created_at)} · {ORIGINS[event.origen] ?? event.origen}{event.usuario_nombre ? ` · ${event.usuario_nombre}` : ''}</small>
              </li>
            ))}
          </ol>
        </section>
        {tracking.soportado && (
          <section aria-label="Línea de tiempo de la transportadora">
            <h3 className={shipStyles.sectionTitle}>Línea de tiempo de la transportadora</h3>
            {(guide.rastreo_eventos ?? []).length === 0 && <p className={styles.muted}>Aún no hay eventos de la transportadora.</p>}
            <ol className={shipStyles.timeline}>
              {(guide.rastreo_eventos ?? []).map((event, position) => (
                <li key={`${event.fecha}-${position}`}>
                  <strong>{event.detalle || event.subestado_nombre || event.subestado}</strong>
                  <small>{formatMoment(event.fecha)}{event.lugar ? ` · ${event.lugar}` : ''}</small>
                </li>
              ))}
            </ol>
          </section>
        )}
      </div>

      {canManage && guide.vigente && (
        <>
          {(guide.acciones ?? []).length > 0 && (
            <section aria-label="Cambiar estado">
              <h3 className={shipStyles.sectionTitle}>Cambiar estado</h3>
              <div className={shipStyles.stateButtons}>
                {guide.acciones.map((state) => (
                  <button
                    key={state}
                    type="button"
                    className={target === state ? styles.primaryBtn : styles.secondaryBtn}
                    onClick={() => { setTarget(state); setError('') }}
                    aria-pressed={target === state}
                  >
                    {stateName(state, meta)}
                  </button>
                ))}
              </div>
              {target && (
                <form className={styles.form} onSubmit={changeState} noValidate>
                  <label className={styles.field}>
                    {needsNote ? `Motivo (obligatorio, mínimo ${minimumNote(meta)} caracteres)` : 'Nota (opcional)'}
                    <textarea value={note} onChange={(event) => setNote(event.target.value)} rows={2} maxLength={500} aria-label="Nota del cambio de estado" />
                  </label>
                  <div className={styles.actions}>
                    <button type="button" className={styles.secondaryBtn} onClick={() => { setTarget(''); setNote('') }}>Cancelar</button>
                    <button type="submit" className={styles.primaryBtn} disabled={busy}>{busy ? 'Guardando…' : `Pasar a «${stateName(target, meta)}»`}</button>
                  </div>
                </form>
              )}
            </section>
          )}

          <form className={shipStyles.quick} onSubmit={saveFreight} noValidate>
            <label className={styles.field}>
              Valor del flete (pesos)
              <input value={freight} onChange={(event) => setFreight(event.target.value)} inputMode="numeric" placeholder="0" />
            </label>
            <button type="submit" className={styles.secondaryBtn} disabled={busy}>Registrar flete</button>
          </form>
        </>
      )}

      {canRegisterReturn(guide, can('envios.devolucion')) && (
        <div className={styles.actions}>
          <button type="button" className={styles.primaryBtn} onClick={registerReturn} disabled={busy}>Registrar devolución en cartera</button>
        </div>
      )}

      {error && <p className={styles.formError} role="alert">{error}</p>}
      <div className={styles.actions}>
        <button type="button" className={styles.secondaryBtn} onClick={onClose}>Cerrar</button>
      </div>
    </Modal>
  )
}

/**
 * Envíos · Guías, ruta `/envios/guias` (`envios.ver`): todas las guías con su semáforo, filtros y el detalle de cada una.
 * Endpoints: `GET /api/envios/guias/` y `GET /api/envios/metadatos/`.
 */
export default function GuidesPage() {
  const [params] = useSearchParams()
  const [meta, setMeta] = useState(null)
  const [guides, setGuides] = useState(null)
  const [state, setState] = useState(params.get('estado') ?? '')
  const [carrier, setCarrier] = useState('')
  const [search, setSearch] = useState('')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [all, setAll] = useState(false)
  const [loadError, setLoadError] = useState('')
  const [viewing, setViewing] = useState(null)

  useEffect(() => {
    apiGet('/api/envios/metadatos/').then(setMeta).catch((error) => setLoadError(error.message))
  }, [])

  const load = useCallback(() => {
    const query = new URLSearchParams({ limit: '200' })
    if (state) query.set('estado', state)
    if (carrier) query.set('transportadora', carrier)
    if (search.trim()) query.set('q', search.trim())
    if (from) query.set('desde', from)
    if (to) query.set('hasta', to)
    if (all) query.set('todas', '1')
    apiGet(`/api/envios/guias/?${query}`).then((data) => (setGuides(data), setLoadError(''))).catch((error) => setLoadError(error.message))
  }, [state, carrier, search, from, to, all])

  useEffect(() => {
    const timer = setTimeout(load, 250)
    return () => clearTimeout(timer)
  }, [load])

  return (
    <div className={styles.page}>
      <header className={styles.pageHeader}>
        <p className={styles.eyebrow}>Envíos</p>
        <h1>Guías de envío</h1>
        <p className={styles.subtitle}>Cada factura despachada tiene una guía de la transportadora. El color indica en qué va: gris por despachar, azul en tránsito, amarillo con novedad, verde entregada y rojo devuelta.</p>
      </header>

      <section className={styles.card}>
        <div className={styles.filters}>
          <input type="search" placeholder="Buscar por factura, cliente o guía" value={search} onChange={(event) => setSearch(event.target.value)} aria-label="Buscar guías" />
          <select value={state} onChange={(event) => setState(event.target.value)} aria-label="Filtrar por estado">
            <option value="">Todos los estados</option>
            {(meta?.estados ?? []).map((item) => <option key={item.codigo} value={item.codigo}>{item.nombre}</option>)}
          </select>
          <select value={carrier} onChange={(event) => setCarrier(event.target.value)} aria-label="Filtrar por transportadora">
            <option value="">Todas las transportadoras</option>
            {(meta?.transportadoras ?? []).map((item) => <option key={item.codigo} value={item.codigo}>{item.nombre}</option>)}
          </select>
          <label>Desde <input type="date" value={from} onChange={(event) => setFrom(event.target.value)} /></label>
          <label>Hasta <input type="date" value={to} onChange={(event) => setTo(event.target.value)} /></label>
          <label><input type="checkbox" checked={all} onChange={(event) => setAll(event.target.checked)} /> Incluir guías reemplazadas</label>
        </div>
        {loadError && <p className={styles.formError}>{loadError}</p>}
        {guides && guides.length === 0 && <p className={styles.empty}>No hay guías con ese filtro.</p>}
        {guides && guides.length > 0 && (
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr><th>Estado</th><th>Factura</th><th>Cliente</th><th>Transportadora y guía</th><th>Relación</th><th className={styles.num}>Flete</th><th /></tr>
              </thead>
              <tbody>
                {guides.map((guide) => (
                  <tr key={guide.id}>
                    <td><GuideBadge color={guide.color} name={guide.estado_nombre} /></td>
                    <td><strong>{guide.factura_numero}</strong><div className={styles.muted}>{money(guide.factura_total)}</div></td>
                    <td>{guide.cliente_nombre}<div className={styles.muted}>{guide.cliente_ciudad}</div></td>
                    <td>
                      {guide.transportadora_nombre}
                      <div className={styles.muted}>{guide.numero_guia}{guide.aviso_formato ? ' · ⚠ revisa el formato' : ''}{!guide.vigente ? ' · reemplazada' : ''}</div>
                    </td>
                    <td>{guide.relacion_codigo || '—'}</td>
                    <td className={styles.num}>{guide.valor_flete ? money(guide.valor_flete) : '—'}</td>
                    <td><button type="button" className={styles.linkBtn} onClick={() => setViewing(guide.id)}>Ver</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {viewing && <GuideDetail guideId={viewing} meta={meta} onChanged={load} onClose={() => setViewing(null)} />}
    </div>
  )
}
