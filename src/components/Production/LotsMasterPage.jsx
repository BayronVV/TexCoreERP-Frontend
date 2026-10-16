import { useEffect, useState } from 'react'
import { apiGet, apiRequest } from '../../api/client'
import { useAuth } from '../../auth/session'
import { fieldErrors, formatDate, formatQty } from '../Inventory/labels'
import { isPositiveInteger } from '../Inventory/orderLines'
import styles from '../Inventory/Inventory.module.css'
import planStyles from './Production.module.css'
import LotTracker, { StateBadge } from './LotTracker'
import { formatDuration, replaceLot } from './lotTracking'
import { MAX_GARMENTS, MAX_LOTS, buildSimulationBody, lotProblems, lotsSum, planProblems, splitEvenly } from './lotSplit'
import {
  buildOrderBody, effectiveLots, emptySizeRow, orderProblems, sizeProblems, sizeTotals, splitByUnits, takenByOthers,
} from './lotSizes'

const NO_PLAN = { data: null, loading: false, error: '' }

// Generación de órdenes y lotes (HU 4.2 / RF11 y RF12): se crea la orden de producción de una referencia, se divide en lotes
// con identificador único y, si se quiere, se reparten las tallas de cada lote. Al crearla, el servidor descuenta del
// almacén el material de la ficha técnica. Antes de crearla, la pantalla simula si hay material (HU 4.1 / RF10): muestra lo
// que pide la ficha, lo disponible, el máximo producible y hasta qué lote alcanza el stock.
export default function LotsMasterPage() {
  const { can } = useAuth()
  const canManage = can('produccion.gestionar')

  const [references, setReferences] = useState(null)
  const [products, setProducts] = useState(null)
  const [loadError, setLoadError] = useState('')
  const [referencia, setReferencia] = useState('')
  const [total, setTotal] = useState('')
  const [resultado, setResultado] = useState('')
  const [responsable, setResponsable] = useState('')
  const [observaciones, setObservaciones] = useState('')
  const [sizes, setSizes] = useState([]) // prendas de cada lote, como texto
  const [mode, setMode] = useState('count')
  const [amount, setAmount] = useState('2')
  const [sizeState, setSizeState] = useState({ key: '', rows: [] }) // tallas de cada lote; se reinician si cambia el reparto
  const [variants, setVariants] = useState([])
  const [plan, setPlan] = useState(NO_PLAN) // simulación de material
  const [saving, setSaving] = useState(false)
  const [errors, setErrors] = useState({})
  const [shortages, setShortages] = useState([])
  const [created, setCreated] = useState(null)
  const [orders, setOrders] = useState(null)
  const [fetchedAt, setFetchedAt] = useState(0) // cuándo llegaron los tiempos que se muestran
  const [openOrder, setOpenOrder] = useState(null) // orden con el seguimiento abierto
  const [cancelling, setCancelling] = useState(null) // { id, motivo }
  const [cancelError, setCancelError] = useState('')

  const loadOrders = () =>
    apiGet('/api/produccion/ordenes/?limit=15')
      .then((data) => (setOrders(data), setFetchedAt(Date.now())))
      .catch((error) => setLoadError(error.message))

  // Tras una acción sobre un lote, el servidor devuelve el lote ya actualizado: se muestra al instante y luego se refresca
  // la lista para que el estado de la orden (planeada, en proceso, en pausa, terminada) también quede al día.
  const updateLot = (orderId, lot) => {
    setOrders((current) => current.map((order) => (order.id === orderId ? replaceLot(order, lot) : order)))
    setFetchedAt(Date.now())
    loadOrders()
  }

  useEffect(() => {
    Promise.all([apiGet('/api/inventario/fichas-tecnicas/'), apiGet('/api/inventario/productos/')])
      .then(([refs, prods]) => {
        setReferences(refs)
        setProducts(prods)
      })
      .catch((error) => setLoadError(error.message))
    loadOrders()
  }, [])

  const reference = references?.find((r) => String(r.id) === referencia)
  const tracked = orders?.find((order) => order.id === openOrder) ?? null
  const generics = (products ?? []).filter((p) => p.tipo === 'GENERICO')

  // Las variantes (talla y color) salen de la referencia elegida.
  useEffect(() => {
    if (!referencia) return undefined
    let alive = true
    apiGet(`/api/referencias/${referencia}/`)
      .then((data) => alive && setVariants(data.variantes ?? []))
      .catch(() => alive && setVariants([]))
    return () => {
      alive = false
    }
  }, [referencia])
  const variantLabel = (v) => `${v.talla} · ${v.color}`

  const lotSizes = effectiveLots(total, sizes)
  const lotsKey = `${referencia}|${lotSizes.join(',')}`
  const rowsByLot = sizeState.key === lotsKey ? sizeState.rows : []
  const lotsError = lotProblems(sizes, total)

  // La simulación espera a que la persona deje de escribir y descarta respuestas de datos que ya cambiaron.
  const simulationKey =
    reference?.tiene_ficha && isPositiveInteger(total) && Number(total) <= MAX_GARMENTS
      ? JSON.stringify(buildSimulationBody({ referencia, total, sizes }))
      : ''
  useEffect(() => {
    if (!simulationKey) return undefined
    let alive = true
    const timer = setTimeout(() => {
      setPlan((current) => ({ ...current, loading: true, error: '' }))
      apiRequest('/api/produccion/simulacion/', { method: 'POST', body: JSON.parse(simulationKey) })
        .then((data) => alive && setPlan({ data, loading: false, error: '' }))
        .catch((error) => {
          if (!alive) return
          const fields = fieldErrors(error)
          setPlan({ data: null, loading: false, error: fields.lotes ?? fields.cantidad ?? fields.referencia ?? error.message })
        })
    }, 400)
    return () => {
      alive = false
      clearTimeout(timer)
    }
  }, [simulationKey])
  const view = simulationKey ? plan : NO_PLAN
  const data = view.data

  const orderIssues = orderProblems({ reference, total, resultado, sizes, rowsByLot })
  const problems = orderIssues.length > 0 ? orderIssues : planProblems({ reference, total, sizes, plan: view })
  const totals = sizeTotals(rowsByLot, (id) => variants.find((v) => String(v.id) === String(id)))
  const canCreate = canManage && problems.length === 0 && !saving

  const updateRows = (lotIndex, change) => {
    const base = lotSizes.map((_, i) => rowsByLot[i] ?? [])
    base[lotIndex] = change(base[lotIndex])
    setSizeState({ key: lotsKey, rows: base })
  }

  // Al llevar el total al máximo, los lotes que ya había se vuelven a repartir en la misma cantidad de partes iguales.
  const applyMaximum = (maximum) => {
    setTotal(String(maximum))
    if (sizes.length > 0) setSizes(splitEvenly(maximum, Math.min(sizes.length, maximum)).map(String))
  }

  const generate = () => {
    const parts = mode === 'count' ? splitEvenly(total, amount) : splitByUnits(total, amount)
    setSizes(parts.map(String))
  }
  const generated = mode === 'count' ? splitEvenly(total, amount) : splitByUnits(total, amount)

  const submit = async (event) => {
    event.preventDefault()
    if (!canCreate) return
    setSaving(true)
    setErrors({})
    setShortages([])
    try {
      const body = buildOrderBody({ referencia, total, resultado, sizes, rowsByLot, responsable, observaciones })
      const order = await apiRequest('/api/produccion/ordenes/', { method: 'POST', body })
      setCreated(order)
      setSizes([])
      setTotal('')
      setObservaciones('')
      loadOrders()
    } catch (error) {
      setErrors(fieldErrors(error))
      setShortages(error.body?.faltantes ?? [])
    } finally {
      setSaving(false)
    }
  }

  const cancelOrder = async () => {
    setCancelError('')
    try {
      await apiRequest(`/api/produccion/ordenes/${cancelling.id}/anular/`, { method: 'POST', body: { motivo: cancelling.motivo } })
      setCancelling(null)
      loadOrders()
    } catch (error) {
      setCancelError(fieldErrors(error).motivo ?? error.message)
    }
  }

  const err = (name) => errors[name] && <span className={styles.fieldError}>{errors[name]}</span>

  return (
    <div className={styles.page}>
      <header className={styles.pageHeader}>
        <p className={styles.eyebrow}>Producción</p>
        <h1>Órdenes de producción</h1>
        <p className={styles.subtitle}>
          Comprueba si hay material para las prendas que quieres fabricar, divídelas en lotes con su código y reparte las tallas
          de cada uno. Al crear la orden se descuenta del almacén el material de la ficha técnica.
        </p>
      </header>

      {loadError && <p className={styles.formError}>{loadError}</p>}

      {created && (
        <div className={styles.banner} role="status">
          <div>
            Orden <strong>{created.codigo}</strong> creada: {created.cantidad} prendas de {created.referencia_codigo} en{' '}
            {created.lotes.length} lote{created.lotes.length === 1 ? '' : 's'} ({created.lotes.map((lot) => lot.codigo).join(', ')}).
            El material ya salió del almacén.
          </div>
        </div>
      )}

      <form className={`${styles.card} ${styles.form}`} onSubmit={submit} noValidate>
        <div className={styles.grid}>
          <div className={`${styles.field} ${styles.full}`}>
            <label htmlFor="ord-referencia">Referencia de jean</label>
            <select id="ord-referencia" value={referencia} onChange={(e) => setReferencia(e.target.value)} disabled={!references}>
              <option value="">{references ? 'Selecciona la referencia' : 'Cargando referencias…'}</option>
              {references?.map((r) => (
                <option key={r.id} value={r.id} disabled={!r.tiene_ficha}>
                  {r.codigo} · {r.nombre} ({r.ajuste_nombre}){r.tiene_ficha ? '' : ' — sin ficha técnica'}
                </option>
              ))}
            </select>
            <span className={styles.hint}>Solo se pueden producir las referencias activas que tienen ficha técnica.</span>
            {err('referencia')}
          </div>

          <label className={styles.field}>
            Prendas a producir
            <input
              type="number" min="1" max={MAX_GARMENTS} step="1" inputMode="numeric" value={total}
              onChange={(e) => setTotal(e.target.value)} placeholder="Ej. 200"
            />
            {err('cantidad')}
          </label>

          <div className={styles.field}>
            <label htmlFor="ord-resultado">Se producirá</label>
            <select id="ord-resultado" value={resultado} onChange={(e) => setResultado(e.target.value)} disabled={!products}>
              <option value="">Selecciona el pantalón genérico</option>
              {generics.map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
            </select>
            {err('producto_resultado')}
          </div>

          <label className={styles.field}>
            Responsable (opcional)
            <input type="text" maxLength={120} value={responsable} onChange={(e) => setResponsable(e.target.value)} placeholder="Por defecto, tú" />
            {err('responsable')}
          </label>
          <label className={`${styles.field} ${styles.full}`}>
            Observaciones (opcional)
            <textarea rows={2} maxLength={1000} value={observaciones} onChange={(e) => setObservaciones(e.target.value)} />
          </label>
        </div>

        <div>
          <h3 className={styles.subhead}>Lotes</h3>
          <p className={styles.muted}>
            Sin dividir se crea un único lote con todo el total. Si divides, los lotes deben sumar exactamente las prendas a producir
            (máximo {MAX_LOTS}).
          </p>
        </div>

        <div className={planStyles.evenRow}>
          <label className={styles.field}>
            Dividir por
            <select value={mode} onChange={(e) => setMode(e.target.value)} aria-label="Forma de dividir en lotes">
              <option value="count">Cantidad de lotes</option>
              <option value="size">Prendas por lote</option>
            </select>
          </label>
          <label className={styles.field}>
            {mode === 'count' ? 'Lotes' : 'Prendas'}
            <input
              type="number" min="1" step="1" inputMode="numeric" value={amount}
              onChange={(e) => setAmount(e.target.value)} aria-label={mode === 'count' ? 'Cantidad de lotes' : 'Prendas por lote'}
            />
          </label>
          <button type="button" className={styles.secondaryBtn} disabled={generated.length === 0} onClick={generate}>
            {mode === 'count' ? 'Repartir en partes iguales' : 'Crear lotes de ese tamaño'}
          </button>
          <button
            type="button" className={styles.secondaryBtn} disabled={sizes.length >= MAX_LOTS}
            onClick={() => setSizes((current) => [...current, ''])}
          >
            + Agregar lote
          </button>
          {sizes.length > 0 && <button type="button" className={styles.linkBtn} onClick={() => setSizes([])}>Sin dividir</button>}
        </div>
        {mode === 'size' && generated.length > 0 && Number(total) % Number(amount) !== 0 && (
          <p className={styles.muted}>El último lote lleva las {generated[generated.length - 1]} prendas que sobran.</p>
        )}
        {err('lotes')}

        {sizes.length > 0 && (
          <p role="status" className={lotsError.length ? styles.fieldError : styles.muted}>
            Asignado {lotsSum(sizes)} de {isPositiveInteger(total) ? total : '—'} prendas. {lotsError.join(' ')}
          </p>
        )}

        {lotSizes.length > 0 && (
          <div>
            <h3 className={styles.subhead}>Tallas por lote</h3>
            <p className={styles.muted}>
              Opcional. Elige las tallas y colores de la referencia y cuántas prendas lleva cada una; deben sumar las prendas del lote.
            </p>
            {variants.length === 0 && referencia && <p className={styles.muted}>La referencia no tiene variantes registradas.</p>}
            <div className={planStyles.lotCards}>
              {lotSizes.map((size, lotIndex) => {
                const rows = rowsByLot[lotIndex] ?? []
                const check = sizeProblems(rows, size)
                return (
                  <article key={lotIndex} className={planStyles.lotCard}>
                    <header className={planStyles.lotHeader}>
                      <strong>Lote {lotIndex + 1}</strong>
                      {sizes.length > 0 && (
                        <input
                          type="number" min="1" step="1" inputMode="numeric" value={sizes[lotIndex]} aria-label={`Prendas del lote ${lotIndex + 1}`}
                          onChange={(e) => setSizes((current) => current.map((s, i) => (i === lotIndex ? e.target.value : s)))}
                        />
                      )}
                      <span className={check.valid ? styles.muted : styles.fieldError}>
                        {rows.length > 0 ? `${check.assigned} / ${isPositiveInteger(size) ? size : '—'} prendas` : `${isPositiveInteger(size) ? size : '—'} prendas`}
                      </span>
                      {sizes.length > 0 && (
                        <button
                          type="button" className={`${styles.linkBtn} ${styles.dangerText}`}
                          onClick={() => setSizes((current) => current.filter((_, i) => i !== lotIndex))}
                        >
                          Quitar lote
                        </button>
                      )}
                    </header>

                    {rows.map((row, rowIndex) => {
                      const taken = takenByOthers(rows, rowIndex)
                      const rowErrors = check.byRow[rowIndex]
                      return (
                        <div key={rowIndex} className={planStyles.sizeRow}>
                          <select
                            value={row.variante} aria-label={`Talla de la fila ${rowIndex + 1} del lote ${lotIndex + 1}`}
                            onChange={(e) => updateRows(lotIndex, (current) => current.map((r, i) => (i === rowIndex ? { ...r, variante: e.target.value } : r)))}
                          >
                            <option value="">Talla y color</option>
                            {variants.map((v) => (
                              <option key={v.id} value={v.id} disabled={taken.has(String(v.id))}>{variantLabel(v)}</option>
                            ))}
                          </select>
                          <input
                            type="number" min="1" step="1" inputMode="numeric" value={row.cantidad} placeholder="Prendas"
                            aria-label={`Prendas de la fila ${rowIndex + 1} del lote ${lotIndex + 1}`}
                            onChange={(e) => updateRows(lotIndex, (current) => current.map((r, i) => (i === rowIndex ? { ...r, cantidad: e.target.value } : r)))}
                          />
                          <button
                            type="button" className={`${styles.linkBtn} ${styles.dangerText}`}
                            onClick={() => updateRows(lotIndex, (current) => current.filter((_, i) => i !== rowIndex))}
                          >
                            Quitar
                          </button>
                          {rowErrors.length > 0 && <span className={styles.fieldError}>{rowErrors.join(' ')}</span>}
                        </div>
                      )
                    })}

                    <div className={planStyles.sizeFooter}>
                      <button
                        type="button" className={styles.secondaryBtn} disabled={variants.length === 0 || rows.length >= variants.length}
                        onClick={() => updateRows(lotIndex, (current) => [...current, emptySizeRow()])}
                      >
                        + Agregar talla
                      </button>
                      {check.general.length > 0 && <span className={styles.fieldError} role="status">{check.general.join(' ')}</span>}
                    </div>
                  </article>
                )
              })}
            </div>

            {totals.length > 0 && (
              <>
                <h3 className={styles.subhead}>Resumen por talla</h3>
                <div className={styles.tableWrap}>
                  <table className={styles.table}>
                    <thead><tr><th>Talla</th><th>Color</th><th className={styles.num}>Prendas</th></tr></thead>
                    <tbody>
                      {totals.map((t) => (
                        <tr key={t.variante}><td>{t.talla}</td><td>{t.color}</td><td className={styles.num}>{t.cantidad}</td></tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>
        )}

        {errors.detail && <p className={styles.formError}>{errors.detail}</p>}
        {shortages.length > 0 && (
          <div className={`${styles.banner} ${styles.bannerWarn}`} role="alert">
            <div>
              <strong>No hay material suficiente:</strong>{' '}
              {shortages.map((s) => `${s.nombre} (hay ${Number(s.disponible)}, se piden ${Number(s.solicitado)} ${s.unidad})`).join('; ')}.
            </div>
          </div>
        )}

        <div className={planStyles.footer}>
          <button type="submit" className={styles.primaryBtn} disabled={!canCreate} aria-describedby="ord-motivo">
            {saving ? 'Creando…' : 'Crear orden'}
          </button>
          <p id="ord-motivo" className={planStyles.reason} role="status">
            {!canManage && 'Tu rol puede consultar las órdenes pero no crearlas.'}
            {canManage && problems[0]}
            {canManage && problems.length === 0 && 'Al crearla se descuenta el material de la ficha técnica del almacén.'}
          </p>
        </div>
      </form>

      {view.loading && <p className={styles.muted} role="status">Calculando la disponibilidad de material…</p>}
      {view.error && <p className={styles.formError}>{view.error}</p>}

      {data && !view.loading && data.cantidad === Number(total) && (
        <section className={styles.card}>
          <h2 className={styles.cardTitle}>Disponibilidad de material</h2>

          <div className={`${styles.banner} ${data.viable ? '' : styles.bannerWarn}`} role="status">
            <div>
              {data.viable ? (
                <>Hay material para producir <strong>{data.cantidad}</strong> prendas de {data.referencia.codigo}.</>
              ) : (
                <><strong>No hay material suficiente</strong> para producir {data.cantidad} prendas de {data.referencia.codigo}.</>
              )}{' '}
              Con el stock actual se pueden fabricar hasta <strong>{data.maximo_producible}</strong> prendas
              {data.cuello_de_botella && (
                <> (lo limita <strong>{data.cuello_de_botella.nombre}</strong>: hay {formatQty(data.cuello_de_botella.disponible, data.cuello_de_botella.unidad)}).</>
              )}
              {data.maximo_producible > 0 && data.maximo_producible !== data.cantidad && (
                <>
                  {' '}
                  <button type="button" className={styles.linkBtn} onClick={() => applyMaximum(data.maximo_producible)}>
                    Usar {data.maximo_producible}
                  </button>
                </>
              )}
            </div>
          </div>

          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Material</th><th className={styles.num}>Por prenda</th><th className={styles.num}>Requerido</th>
                  <th className={styles.num}>Disponible</th><th className={styles.num}>Falta</th><th>Estado</th>
                </tr>
              </thead>
              <tbody>
                {data.lineas.map((row) => (
                  <tr key={row.producto} className={row.suficiente ? '' : styles.rowShort}>
                    <td>{row.nombre}</td>
                    <td className={styles.num}>{formatQty(row.por_prenda, row.unidad)}{Number(row.merma) > 0 ? ` (+${Number(row.merma)} %)` : ''}</td>
                    <td className={styles.num}>{formatQty(row.requerido, row.unidad)}</td>
                    <td className={styles.num}>{formatQty(row.disponible, row.unidad)}</td>
                    <td className={styles.num}>{row.suficiente ? '—' : formatQty(row.falta, row.unidad)}</td>
                    <td>
                      <span className={`${styles.badge} ${row.suficiente ? styles.badgeOk : styles.badgeDanger}`}>
                        {row.suficiente ? 'Alcanza' : 'Falta'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {data.lotes && (
            <>
              <h3 className={styles.subhead}>Cobertura por lote</h3>
              <p className={styles.muted}>
                Los lotes comparten el mismo material, así que un lote se cubre si alcanza para él y los anteriores juntos.
                {' '}{data.lotes_cubiertos} de {data.lotes.length} lotes cubiertos.
              </p>
              <div className={styles.tableWrap}>
                <table className={styles.table}>
                  <thead>
                    <tr><th>Lote</th><th className={styles.num}>Prendas</th><th className={styles.num}>Acumulado</th><th>Estado</th></tr>
                  </thead>
                  <tbody>
                    {data.lotes.map((lot) => (
                      <tr key={lot.numero} className={lot.cubierto ? '' : styles.rowShort}>
                        <td>Lote {lot.numero}</td>
                        <td className={styles.num}>{lot.cantidad}</td>
                        <td className={styles.num}>{lot.acumulado}</td>
                        <td>
                          <span className={`${styles.badge} ${lot.cubierto ? styles.badgeOk : styles.badgeDanger}`}>
                            {lot.cubierto ? 'Cubierto' : 'Sin material'}
                          </span>
                          {!lot.cubierto && <span className={styles.muted}> · falta {lot.faltantes.join(', ')}</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </section>
      )}

      <section className={styles.card}>
        <h2 className={styles.cardTitle}>Órdenes recientes</h2>
        {orders === null ? (
          <p className={styles.muted}>Cargando…</p>
        ) : orders.length === 0 ? (
          <p className={styles.muted}>Todavía no hay órdenes de producción.</p>
        ) : (
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Orden</th><th>Referencia</th><th className={styles.num}>Prendas</th><th>Lotes</th><th>Fecha</th><th>Estado</th><th>Tiempo neto</th><th />
                </tr>
              </thead>
              <tbody>
                {orders.map((order) => (
                  <tr key={order.id} className={openOrder === order.id ? planStyles.rowOpen : ''}>
                    <td>{order.codigo}</td>
                    <td>{order.referencia_codigo} · {order.referencia_nombre}</td>
                    <td className={styles.num}>{order.cantidad}</td>
                    <td>{order.lotes.map((lot) => `${lot.codigo.split('-L')[1] ? `L${lot.codigo.split('-L')[1]}` : lot.codigo}: ${lot.cantidad}`).join(' · ')}</td>
                    <td>{formatDate(order.fecha_salida)}</td>
                    <td><StateBadge state={order.estado_produccion} name={order.estado_produccion_nombre} /></td>
                    <td>{formatDuration(order.tiempo_neto_segundos)}</td>
                    <td>
                      <button type="button" className={styles.linkBtn} aria-expanded={openOrder === order.id}
                        onClick={() => setOpenOrder(openOrder === order.id ? null : order.id)}>
                        {openOrder === order.id ? 'Ocultar seguimiento' : 'Seguimiento'}
                      </button>
                      {canManage && order.estado === 'EN_PROCESO' && (
                        <button type="button" className={`${styles.linkBtn} ${styles.dangerText}`} onClick={() => setCancelling({ id: order.id, motivo: '' })}>
                          Anular
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {tracked && (
          <div>
            <h3 className={styles.subhead}>Seguimiento de {tracked.codigo}</h3>
            <p className={styles.muted}>
              Cada lote recorre sus etapas en orden. El tiempo es neto: no cuenta las pausas.
            </p>
            <LotTracker order={tracked} canManage={canManage} fetchedAt={fetchedAt} onChange={(lot) => updateLot(tracked.id, lot)} />
          </div>
        )}

        {cancelling && (
          <div className={planStyles.evenRow}>
            <label className={styles.field}>
              Motivo de la anulación
              <input type="text" maxLength={255} value={cancelling.motivo} onChange={(e) => setCancelling({ ...cancelling, motivo: e.target.value })} />
            </label>
            <button type="button" className={styles.primaryBtn} disabled={!cancelling.motivo.trim()} onClick={cancelOrder}>
              Confirmar anulación
            </button>
            <button type="button" className={styles.linkBtn} onClick={() => setCancelling(null)}>Cancelar</button>
            {cancelError && <span className={styles.fieldError}>{cancelError}</span>}
          </div>
        )}
      </section>
    </div>
  )
}
