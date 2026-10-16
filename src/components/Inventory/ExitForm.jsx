import { useEffect, useMemo, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { apiGet, apiRequest } from '../../api/client'
import { useAuth } from '../../auth/session'
import { useToast } from '../ui/toastContext'
import EvidencePicker from './EvidencePicker'
import { uploadEvidence } from './evidence'
import { ORDER_TYPES, PURCHASED, WHOLE_UNITS, fieldErrors, formatQty, todayISO, typeLabel } from './labels'
import { applyPlan, buildOrderBody, isPositiveInteger, isShort, orderProblems, stepFor, withoutPlan } from './orderLines'
import styles from './Inventory.module.css'

// Qué puede llevar la cesta y qué producto resulta, según el tipo de orden.
const RULES = {
  PRODUCCION: {
    inputs: PURCHASED,
    output: 'GENERICO',
    outputHelp: 'Pantalón genérico que se obtiene al terminar (entrará en Ingreso).',
    basketHelp: 'Los materiales salen de la ficha técnica de la referencia según las prendas a producir. Puedes ajustarlos o agregar otros.',
  },
  LAVANDERIA: {
    inputs: [...PURCHASED, 'GENERICO'],
    output: 'TERMINADO',
    outputHelp: 'Modelo de jean que se obtendrá al volver de lavandería (entrará en Ingreso).',
    basketHelp: 'Los pantalones genéricos que se envían, más botones, remaches y demás insumos de detalle.',
  },
}

const EMPTY = {
  fecha_salida: todayISO(), responsable: '', destino: '', referencia: '',
  producto_resultado: '', cantidad_prendas: '', observaciones: '',
}
const NO_PLAN = { data: null, loading: false, error: '' }

// Salida de inventario hacia producción o lavandería. La orden se hace sobre una referencia de jean elegida de la lista:
// en producción, al indicar cuántas prendas se fabrican, la cesta se llena con los materiales de su ficha técnica.
export default function ExitForm({ products, onChanged }) {
  const notify = useToast()
  const { can } = useAuth()
  const handedOver = useLocation().state?.plan // referencia y prendas que trae la pantalla Planificar producción
  const [tipo, setTipo] = useState('PRODUCCION')
  const [form, setForm] = useState(() =>
    handedOver ? { ...EMPTY, referencia: String(handedOver.referencia), cantidad_prendas: String(handedOver.cantidad) } : EMPTY,
  )
  const [references, setReferences] = useState(null)
  const [referencesError, setReferencesError] = useState('')
  const [basket, setBasket] = useState([]) // [{ producto, cantidad, desdeFicha? }]
  const [plan, setPlan] = useState(NO_PLAN)
  const [pick, setPick] = useState({ producto: '', cantidad: '' })
  const [pickError, setPickError] = useState('')
  const [files, setFiles] = useState([])
  const [errors, setErrors] = useState({})
  const [shortages, setShortages] = useState([])
  const [saving, setSaving] = useState(false)

  const rules = RULES[tipo]
  const prefix = ORDER_TYPES.find((t) => t.value === tipo).prefix
  const byId = useMemo(() => new Map(products.map((p) => [String(p.id), p])), [products])
  const productOf = (id) => byId.get(String(id))
  const inputProducts = products.filter((p) => rules.inputs.includes(p.tipo))
  const outputProducts = products.filter((p) => p.tipo === rules.output)
  const reference = references?.find((r) => String(r.id) === form.referencia)

  useEffect(() => {
    apiGet('/api/inventario/fichas-tecnicas/')
      .then(setReferences)
      .catch((error) => setReferencesError(error.message))
  }, [])

  // Con referencia (que tenga ficha) y prendas válidas, el servidor calcula los materiales; se espera a que la persona deje de escribir.
  const planKey =
    tipo === 'PRODUCCION' && reference?.tiene_ficha && isPositiveInteger(form.cantidad_prendas)
      ? `${reference.id}:${Number(form.cantidad_prendas)}`
      : ''
  useEffect(() => {
    if (!planKey) return undefined
    const [referenceId, garments] = planKey.split(':')
    let alive = true
    const timer = setTimeout(() => {
      setPlan((current) => ({ ...current, loading: true, error: '' }))
      apiGet(`/api/inventario/fichas-tecnicas/${referenceId}/consumo/?cantidad=${garments}`)
        .then((data) => {
          if (!alive) return
          setPlan({ data, loading: false, error: '' })
          setBasket((current) => applyPlan(current, data.lineas))
          setShortages([])
        })
        .catch((error) => alive && setPlan({ data: null, loading: false, error: error.message }))
    }, 350)
    return () => {
      alive = false
      clearTimeout(timer)
    }
  }, [planKey])

  const set = (field) => (event) => setForm((current) => ({ ...current, [field]: event.target.value }))

  const clearPlan = () => {
    setPlan(NO_PLAN)
    setBasket(withoutPlan)
  }

  const changeType = (event) => {
    setTipo(event.target.value)
    setBasket([])
    setPlan(NO_PLAN)
    setPick({ producto: '', cantidad: '' })
    setForm((current) => ({ ...current, referencia: '', producto_resultado: '', cantidad_prendas: '', destino: '' }))
    setErrors({})
    setShortages([])
  }

  const pickReference = (event) => {
    setForm((current) => ({ ...current, referencia: event.target.value }))
    clearPlan()
  }

  const changeGarments = (event) => {
    const value = event.target.value
    setForm((current) => ({ ...current, cantidad_prendas: value }))
    if (!isPositiveInteger(value)) clearPlan()
  }

  const lineProduct = (line) => productOf(line.producto)

  const addToBasket = () => {
    const product = productOf(pick.producto)
    const quantity = Number(pick.cantidad)
    if (!product) return setPickError('Elige un producto.')
    if (!(quantity > 0)) return setPickError('Escribe una cantidad mayor que cero.')
    if (WHOLE_UNITS.includes(product.unidad) && !Number.isInteger(quantity)) {
      return setPickError('Esta unidad no admite decimales.')
    }
    if (product.tipo === 'GENERICO' && basket.some((l) => lineProduct(l)?.tipo === 'GENERICO' && l.producto !== product.id)) {
      return setPickError('Una orden de lavandería envía un solo tipo de pantalón genérico.')
    }
    setPickError('')
    setShortages([])
    setBasket((current) => {
      const existing = current.find((l) => l.producto === product.id)
      if (!existing) return [...current, { producto: product.id, cantidad: String(quantity) }]
      return current.map((l) => (l === existing ? { ...l, cantidad: String(Number(l.cantidad) + quantity) } : l))
    })
    setPick({ producto: '', cantidad: '' })
  }

  const updateLine = (id, cantidad) =>
    setBasket((current) => current.map((l) => (l.producto === id ? { ...l, cantidad } : l)))

  const problems = orderProblems({ tipo, form, basket, productOf, reference })
  const canSubmit = problems.length === 0 && !plan.loading
  const missingGeneric = tipo === 'LAVANDERIA' && basket.length > 0 && !basket.some((l) => lineProduct(l)?.tipo === 'GENERICO')

  const reset = () => {
    setForm({ ...EMPTY, fecha_salida: todayISO() })
    setBasket([])
    setPlan(NO_PLAN)
    setFiles([])
    setErrors({})
    setShortages([])
  }

  const submit = async (event) => {
    event.preventDefault()
    setSaving(true)
    setErrors({})
    setShortages([])
    let order
    try {
      order = await apiRequest('/api/inventario/ordenes/', { method: 'POST', body: buildOrderBody({ form, tipo, basket }) })
    } catch (error) {
      setErrors(fieldErrors(error))
      setShortages(error.body?.faltantes ?? [])
      setSaving(false)
      return
    }
    try {
      await uploadEvidence('ordenes', order.id, files)
      notify(`Orden ${order.codigo} registrada. Cuando regrese lo fabricado, dale ingreso en la pestaña Ingreso.`)
    } catch (error) {
      notify(`Orden ${order.codigo} registrada, pero las evidencias no se subieron: ${error.message}`, 'error')
    }
    reset()
    setSaving(false)
    onChanged()
  }

  const err = (name) => errors[name] && <span className={styles.fieldError}>{errors[name]}</span>
  const referenceHint = reference
    ? `${reference.materiales} material${reference.materiales === 1 ? '' : 'es'} en la ficha${reference.lavado_nombre ? ` · Lavado: ${reference.lavado_nombre}` : ''}. Su código será el lote del inventario.`
    : 'Su código (REF-0001) será el lote con el que volverá al inventario.'

  return (
    <>
      <form className={`${styles.card} ${styles.form}`} onSubmit={submit}>
        <h2 className={styles.cardTitle}>Salida de inventario</h2>

        <div className={styles.grid}>
          <label className={styles.field}>
            Tipo de salida
            <select value={tipo} onChange={changeType}>
              {ORDER_TYPES.map((t) => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
          </label>
          <div className={styles.field}>
            Número de orden
            <div className={styles.readonly}>{prefix}-#### (se asigna al guardar)</div>
          </div>
          <label className={styles.field}>
            Fecha de salida
            <input type="date" value={form.fecha_salida} max={todayISO()} onChange={set('fecha_salida')} required />
            {err('fecha_salida')}
          </label>
          <label className={styles.field}>
            {tipo === 'PRODUCCION' ? 'Responsable de la producción' : 'Responsable de la lavandería'}
            <input value={form.responsable} onChange={set('responsable')} maxLength={120} required placeholder="Nombre de quien se encarga" />
            {err('responsable')}
          </label>
          {tipo === 'LAVANDERIA' && (
            <label className={styles.field}>
              Lavandería / taller (opcional)
              <input value={form.destino} onChange={set('destino')} maxLength={120} />
            </label>
          )}

          <div className={`${styles.field} ${styles.full}`}>
            <label htmlFor="sal-referencia">Referencia de jean</label>
            <select id="sal-referencia" value={form.referencia} onChange={pickReference} required disabled={!references}>
              <option value="">{references ? 'Selecciona la referencia' : 'Cargando referencias…'}</option>
              {references?.map((r) => {
                const blocked = tipo === 'PRODUCCION' && !r.tiene_ficha
                return (
                  <option key={r.id} value={r.id} disabled={blocked}>
                    {r.codigo} · {r.nombre} ({r.ajuste_nombre}){blocked ? ' — sin ficha técnica' : ''}
                  </option>
                )
              })}
            </select>
            <span className={styles.hint}>
              {referenceHint}{' '}
              {references && references.length === 0 && 'No hay referencias activas. '}
              {tipo === 'PRODUCCION' && references?.some((r) => !r.tiene_ficha) && can('fichas_tecnicas.gestionar') && (
                <>Las que no tienen ficha se definen en <Link to="/referencias" className={styles.textLink}>Referencias de jean</Link>.</>
              )}
            </span>
            {referencesError && <span className={styles.fieldError}>{referencesError}</span>}
            {err('referencia')}
          </div>

          {tipo === 'PRODUCCION' && (
            <label className={styles.field}>
              Prendas a producir
              <input
                type="number" min="1" step="1" value={form.cantidad_prendas} onChange={changeGarments}
                required placeholder="Ej. 100"
              />
              <span className={styles.hint}>Con este número se calculan los materiales de la ficha.</span>
              {err('cantidad_prendas')}
            </label>
          )}
          <div className={styles.field}>
            <label htmlFor="sal-resultado">{tipo === 'PRODUCCION' ? 'Se producirá' : 'Modelo a crear'}</label>
            <div className={styles.inline}>
              <select id="sal-resultado" value={form.producto_resultado} onChange={set('producto_resultado')} required>
                <option value="">Selecciona</option>
                {outputProducts.map((p) => (
                  <option key={p.id} value={p.id}>{p.nombre}</option>
                ))}
              </select>
            </div>
            <span className={styles.hint}>
              {rules.outputHelp} ¿No está? Créalo en el <Link to="/inventario/catalogo" className={styles.textLink}>Catálogo</Link>.
            </span>
            {err('producto_resultado')}
          </div>
        </div>

        <div>
          <h3 className={styles.subhead}>Cesta de la orden</h3>
          <p className={styles.muted}>{rules.basketHelp}</p>
        </div>

        {plan.loading && <p className={styles.muted} role="status">Calculando los materiales de la ficha…</p>}
        {plan.error && <p className={styles.formError}>{plan.error}</p>}
        {plan.data && !plan.loading && (
          <div className={`${styles.banner} ${plan.data.viable ? '' : styles.bannerWarn}`} role="status">
            <div>
              Materiales calculados con la ficha de <strong>{plan.data.referencia.codigo}</strong> para{' '}
              <strong>{plan.data.cantidad}</strong> prendas (con la merma, redondeado hacia arriba). Si cambias la
              referencia o la cantidad se recalculan.
              {!plan.data.viable && (
                <>
                  {' '}<strong>Con el stock actual faltan:</strong>
                  <ul>
                    {plan.data.faltantes.map((row) => (
                      <li key={row.producto}>
                        {row.nombre}: faltan {formatQty(row.falta, row.unidad)} (se necesitan {formatQty(row.requerido, row.unidad)} y hay {formatQty(row.disponible, row.unidad)}).
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </div>
          </div>
        )}

        <div className={styles.basketAdd}>
          <label className={styles.field}>
            Agregar otro producto
            <select value={pick.producto} onChange={(e) => setPick((c) => ({ ...c, producto: e.target.value }))}>
              <option value="">Selecciona</option>
              {inputProducts.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nombre} — {typeLabel(p.tipo)} (hay {formatQty(p.stock_actual, p.unidad)})
                </option>
              ))}
            </select>
          </label>
          <label className={styles.field}>
            Cantidad {productOf(pick.producto) ? `(${productOf(pick.producto).unidad})` : ''}
            <input
              type="number" min="0" step={stepFor(productOf(pick.producto)?.unidad)} value={pick.cantidad}
              onChange={(e) => setPick((c) => ({ ...c, cantidad: e.target.value }))}
              onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addToBasket())}
            />
          </label>
          <button type="button" className={styles.secondaryBtn} onClick={addToBasket}>Agregar a la cesta</button>
        </div>
        {pickError && <span className={styles.fieldError}>{pickError}</span>}

        {basket.length === 0 ? (
          <p className={styles.empty}>
            {tipo === 'PRODUCCION'
              ? 'La cesta está vacía. Elige la referencia e indica las prendas a producir, o agrega los productos a mano.'
              : 'La cesta está vacía. Agrega los productos que salen en esta orden.'}
          </p>
        ) : (
          <div className={styles.tableWrap}>
            <table className={`${styles.table} ${styles.basketTable}`}>
              <thead>
                <tr>
                  <th>Producto</th>
                  <th className={styles.num}>Disponible</th>
                  <th>Cantidad a sacar</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {basket.map((line) => {
                  const product = lineProduct(line)
                  const short = isShort(line, product)
                  return (
                    <tr key={line.producto} className={short ? styles.rowShort : ''}>
                      <td>
                        {product.nombre}
                        <span className={styles.muted}> · {typeLabel(product.tipo)}</span>
                        {line.desdeFicha && <span className={`${styles.badge} ${styles.badgeInfo}`}> Ficha</span>}
                      </td>
                      <td className={styles.num}>{formatQty(product.stock_actual, product.unidad)}</td>
                      <td>
                        <input
                          type="number" min="0" step={stepFor(product.unidad)} value={line.cantidad}
                          onChange={(e) => updateLine(line.producto, e.target.value)} aria-label={`Cantidad de ${product.nombre}`}
                        />{' '}
                        {product.unidad}
                        {short && <div className={styles.shortText}>Stock insuficiente</div>}
                      </td>
                      <td>
                        <button
                          type="button" className={`${styles.linkBtn} ${styles.dangerText}`}
                          onClick={() => setBasket((current) => current.filter((l) => l !== line))}
                        >
                          Quitar
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
        {missingGeneric && (
          <span className={styles.fieldError}>Agrega los pantalones genéricos que se envían a lavandería.</span>
        )}
        {err('lineas')}

        {shortages.length > 0 && (
          <div className={`${styles.banner} ${styles.bannerDanger}`} role="alert">
            <div>
              <strong>No hay stock suficiente para enviar la orden.</strong>
              <ul>
                {shortages.map((s) => (
                  <li key={s.producto}>
                    {s.nombre}: hay {formatQty(s.disponible, s.unidad)} y pediste {formatQty(s.solicitado, s.unidad)}.
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}

        <label className={styles.field}>
          Observaciones
          <textarea value={form.observaciones} onChange={set('observaciones')} maxLength={1000} />
        </label>
        <EvidencePicker files={files} onChange={setFiles} />

        {errors.detail && shortages.length === 0 && <p className={styles.formError}>{errors.detail}</p>}
        <div className={styles.actions}>
          <button type="button" className={styles.secondaryBtn} onClick={reset}>Limpiar</button>
          <button
            type="submit" className={styles.primaryBtn} disabled={saving || !canSubmit}
            title={problems.length ? problems.join(' ') : undefined}
          >
            {saving ? 'Guardando…' : `Registrar orden ${prefix}`}
          </button>
        </div>
      </form>
    </>
  )
}
