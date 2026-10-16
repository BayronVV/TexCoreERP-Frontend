import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { apiGet, apiRequest } from '../../api/client'
import { useAuth } from '../../auth/session'
import { fieldErrors, formatQty } from '../Inventory/labels'
import { isPositiveInteger } from '../Inventory/orderLines'
import styles from '../Inventory/Inventory.module.css'
import planStyles from './Production.module.css'
import { MAX_LOTS, buildSimulationBody, lotProblems, lotsSum, planProblems, splitEvenly } from './lotSplit'

const NO_PLAN = { data: null, loading: false, error: '' }

// Planificar producción (HU 4.1 / RF10): antes de crear una orden se simula si hay material para las prendas que se
// quieren fabricar, con la ficha técnica de la referencia, y se configura cómo se divide el total en lotes.
// Aquí no se guarda nada: «Crear orden» lleva el plan a «Órdenes y lotes» (HU 4.2), donde se genera la orden y se reparten las tallas.
export default function ProductionPlanPage() {
  const { can } = useAuth()
  const navigate = useNavigate()
  const canCreateOrders = can('produccion.gestionar')
  const [references, setReferences] = useState(null)
  const [referencesError, setReferencesError] = useState('')
  const [referencia, setReferencia] = useState('')
  const [total, setTotal] = useState('')
  const [sizes, setSizes] = useState([]) // tamaños de los lotes, como texto
  const [evenCount, setEvenCount] = useState('2')
  const [plan, setPlan] = useState(NO_PLAN)

  useEffect(() => {
    apiGet('/api/inventario/fichas-tecnicas/')
      .then(setReferences)
      .catch((error) => setReferencesError(error.message))
  }, [])

  const reference = references?.find((r) => String(r.id) === referencia)
  const lotsError = lotProblems(sizes, total)

  // La simulación espera a que la persona deje de escribir y descarta respuestas de datos que ya cambiaron.
  const simulationKey =
    reference?.tiene_ficha && isPositiveInteger(total) && Number(total) <= 100000
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
  const problems = planProblems({ reference, total, sizes, plan: view })
  const viable = problems.length === 0
  const canCreate = viable && canCreateOrders

  const setSize = (index, value) => setSizes((current) => current.map((size, i) => (i === index ? value : size)))
  const data = view.data

  // Al llevar el total al máximo, los lotes que ya había se vuelven a repartir en la misma cantidad de partes iguales.
  const applyMaximum = (maximum) => {
    setTotal(String(maximum))
    if (sizes.length > 0) setSizes(splitEvenly(maximum, Math.min(sizes.length, maximum)).map(String))
  }

  const create = () => {
    // El plan viaja a «Órdenes y lotes» ya cargado: referencia, total y lotes.
    navigate('/produccion/ordenes', { state: { plan: { referencia: Number(referencia), cantidad: Number(total), lotes: sizes.map(Number) } } })
  }

  return (
    <div className={styles.page}>
      <header className={styles.pageHeader}>
        <p className={styles.eyebrow}>Producción</p>
        <h1>Planificar producción</h1>
        <p className={styles.subtitle}>
          Comprueba si hay material en el almacén para las prendas que quieres fabricar y decide cómo dividirlas en lotes.
        </p>
      </header>

      <section className={`${styles.card} ${styles.form}`}>
        <div className={styles.grid}>
          <div className={`${styles.field} ${styles.full}`}>
            <label htmlFor="plan-referencia">Referencia de jean</label>
            <select id="plan-referencia" value={referencia} onChange={(e) => setReferencia(e.target.value)} disabled={!references}>
              <option value="">{references ? 'Selecciona la referencia' : 'Cargando referencias…'}</option>
              {references?.map((r) => (
                <option key={r.id} value={r.id} disabled={!r.tiene_ficha}>
                  {r.codigo} · {r.nombre} ({r.ajuste_nombre}){r.tiene_ficha ? '' : ' — sin ficha técnica'}
                </option>
              ))}
            </select>
            <span className={styles.hint}>
              {reference
                ? `${reference.materiales} material${reference.materiales === 1 ? '' : 'es'} en la ficha${reference.lavado_nombre ? ` · Lavado: ${reference.lavado_nombre}` : ''}.`
                : 'Solo se pueden planificar las referencias activas que tienen ficha técnica.'}
            </span>
            {referencesError && <span className={styles.fieldError}>{referencesError}</span>}
          </div>

          <label className={styles.field}>
            Prendas a producir
            <input
              type="number" min="1" step="1" inputMode="numeric" value={total}
              onChange={(e) => setTotal(e.target.value)} placeholder="Ej. 200"
            />
          </label>
        </div>

        <div>
          <h3 className={styles.subhead}>Lotes</h3>
          <p className={styles.muted}>
            Opcional. Divide el total en lotes que se cortan y cosen por separado; deben sumar exactamente las prendas a producir.
            Los lotes se registran al crear la orden.
          </p>
        </div>

        <div className={planStyles.evenRow}>
          <label className={styles.field}>
            Dividir en
            <input
              type="number" min="1" max={MAX_LOTS} step="1" inputMode="numeric" value={evenCount}
              onChange={(e) => setEvenCount(e.target.value)} aria-label="Cantidad de lotes iguales"
            />
          </label>
          <button
            type="button" className={styles.secondaryBtn}
            disabled={splitEvenly(total, evenCount).length === 0}
            onClick={() => setSizes(splitEvenly(total, evenCount).map(String))}
          >
            Repartir en partes iguales
          </button>
          <button
            type="button" className={styles.secondaryBtn} disabled={sizes.length >= MAX_LOTS}
            onClick={() => setSizes((current) => [...current, ''])}
          >
            + Agregar lote
          </button>
          {sizes.length > 0 && (
            <button type="button" className={styles.linkBtn} onClick={() => setSizes([])}>Sin dividir</button>
          )}
        </div>

        {sizes.length > 0 && (
          <>
            <div className={styles.tableWrap}>
              <table className={`${styles.table} ${planStyles.lotTable}`}>
                <thead>
                  <tr><th>Lote</th><th>Prendas</th><th /></tr>
                </thead>
                <tbody>
                  {sizes.map((size, index) => (
                    <tr key={index}>
                      <td>Lote {index + 1}</td>
                      <td>
                        <input
                          type="number" min="1" step="1" inputMode="numeric" value={size}
                          onChange={(e) => setSize(index, e.target.value)} aria-label={`Prendas del lote ${index + 1}`}
                        />
                      </td>
                      <td>
                        <button
                          type="button" className={`${styles.linkBtn} ${styles.dangerText}`}
                          onClick={() => setSizes((current) => current.filter((_, i) => i !== index))}
                        >
                          Quitar
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p role="status" className={lotsError.length ? styles.fieldError : styles.muted}>
              Asignado {lotsSum(sizes)} de {isPositiveInteger(total) ? total : '—'} prendas.{' '}
              {lotsError.length > 0 && lotsError.join(' ')}
            </p>
          </>
        )}
      </section>

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
                <>
                  <strong>No hay material suficiente</strong> para producir {data.cantidad} prendas de {data.referencia.codigo}.
                </>
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
                  <th>Material</th>
                  <th className={styles.num}>Por prenda</th>
                  <th className={styles.num}>Requerido</th>
                  <th className={styles.num}>Disponible</th>
                  <th className={styles.num}>Falta</th>
                  <th>Estado</th>
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

      <div className={planStyles.footer}>
        <button
          type="button" className={styles.primaryBtn} disabled={!canCreate} onClick={create}
          aria-describedby="plan-motivo"
        >
          Crear orden
        </button>
        <p id="plan-motivo" className={planStyles.reason} role="status">
          {!viable && problems[0]}
          {viable && !canCreateOrders && 'El plan es viable. Tu rol no crea órdenes de producción: pásale la referencia y la cantidad a Producción.'}
          {canCreate && 'Hay material. Sigue en «Órdenes y lotes» con este plan ya cargado.'}
        </p>
      </div>
    </div>
  )
}
