import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { apiGet, apiRequest } from '../../api/client'
import { useToast } from '../ui/toastContext'
import EvidencePicker from './EvidencePicker'
import { uploadEvidence } from './evidence'
import { WHOLE_UNITS, fieldErrors, formatQty, todayISO, typeLabel } from './labels'
import { buildOrderBody, isShort, orderProblems, stepFor } from './orderLines'
import styles from './Inventory.module.css'

const TIPO = 'LAVANDERIA'
const PREFIX = 'LV'
const EMPTY = {
  fecha_salida: todayISO(), responsable: '', destino: '', referencia: '',
  producto_resultado: '', cantidad_prendas: '', observaciones: '',
}

// Salida de inventario hacia la lavandería: se envían pantalones genéricos ya cosidos y regresan como una referencia de jean.
// Solo viajan las prendas: botones y remaches se colocan después, en terminación, y los químicos los pone la lavandería.
// Las órdenes de producción se crean desde Producción → Órdenes de producción, que calcula el material con la ficha técnica.
export default function ExitForm({ products, onChanged }) {
  const notify = useToast()
  const [form, setForm] = useState(EMPTY)
  const [references, setReferences] = useState(null)
  const [referencesError, setReferencesError] = useState('')
  const [basket, setBasket] = useState([]) // [{ producto, cantidad }]
  const [pick, setPick] = useState({ producto: '', cantidad: '' })
  const [pickError, setPickError] = useState('')
  const [files, setFiles] = useState([])
  const [errors, setErrors] = useState({})
  const [shortages, setShortages] = useState([])
  const [saving, setSaving] = useState(false)

  const byId = useMemo(() => new Map(products.map((p) => [String(p.id), p])), [products])
  const productOf = (id) => byId.get(String(id))
  const garments = products.filter((p) => p.tipo === 'GENERICO')
  const outputProducts = products.filter((p) => p.tipo === 'TERMINADO')
  const reference = references?.find((r) => String(r.id) === form.referencia)

  useEffect(() => {
    apiGet('/api/inventario/fichas-tecnicas/')
      .then(setReferences)
      .catch((error) => setReferencesError(error.message))
  }, [])

  const set = (field) => (event) => setForm((current) => ({ ...current, [field]: event.target.value }))

  const addToBasket = () => {
    const product = productOf(pick.producto)
    const quantity = Number(pick.cantidad)
    if (!product) return setPickError('Elige el pantalón genérico.')
    if (!(quantity > 0)) return setPickError('Escribe una cantidad mayor que cero.')
    if (WHOLE_UNITS.includes(product.unidad) && !Number.isInteger(quantity)) {
      return setPickError('Esta unidad no admite decimales.')
    }
    if (basket.some((l) => l.producto !== product.id)) {
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

  const problems = orderProblems({ tipo: TIPO, form, basket, productOf, reference })

  const reset = () => {
    setForm({ ...EMPTY, fecha_salida: todayISO() })
    setBasket([])
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
      order = await apiRequest('/api/inventario/ordenes/', { method: 'POST', body: buildOrderBody({ form, tipo: TIPO, basket }) })
    } catch (error) {
      setErrors(fieldErrors(error))
      setShortages(error.body?.faltantes ?? [])
      setSaving(false)
      return
    }
    try {
      await uploadEvidence('ordenes', order.id, files)
      notify(`Orden ${order.codigo} registrada. Cuando regresen las prendas lavadas, dales ingreso en la pestaña Ingreso.`)
    } catch (error) {
      notify(`Orden ${order.codigo} registrada, pero las evidencias no se subieron: ${error.message}`, 'error')
    }
    reset()
    setSaving(false)
    onChanged()
  }

  const err = (name) => errors[name] && <span className={styles.fieldError}>{errors[name]}</span>
  const referenceHint = reference
    ? `${reference.codigo} · ${reference.nombre}. Su código será el lote con el que volverá al inventario.`
    : 'Su código (REF-0001) será el lote con el que volverá al inventario.'

  return (
    <form className={`${styles.card} ${styles.form}`} onSubmit={submit}>
      <h2 className={styles.cardTitle}>Salida a lavandería</h2>
      <p className={styles.muted}>
        Envía pantalones genéricos a lavar. Las órdenes de producción se crean en{' '}
        <Link to="/produccion/ordenes" className={styles.textLink}>Producción → Órdenes de producción</Link>.
      </p>

      <div className={styles.grid}>
        <div className={styles.field}>
          Número de orden
          <div className={styles.readonly}>{PREFIX}-#### (se asigna al guardar)</div>
        </div>
        <label className={styles.field}>
          Fecha de salida
          <input type="date" value={form.fecha_salida} max={todayISO()} onChange={set('fecha_salida')} required />
          {err('fecha_salida')}
        </label>
        <label className={styles.field}>
          Responsable de la lavandería
          <input value={form.responsable} onChange={set('responsable')} maxLength={120} required placeholder="Nombre de quien se encarga" />
          {err('responsable')}
        </label>
        <label className={styles.field}>
          Lavandería / taller (opcional)
          <input value={form.destino} onChange={set('destino')} maxLength={120} />
        </label>

        <div className={`${styles.field} ${styles.full}`}>
          <label htmlFor="sal-referencia">Referencia de jean</label>
          <select id="sal-referencia" value={form.referencia} onChange={set('referencia')} required disabled={!references}>
            <option value="">{references ? 'Selecciona la referencia' : 'Cargando referencias…'}</option>
            {references?.map((r) => (
              <option key={r.id} value={r.id}>{r.codigo} · {r.nombre} ({r.ajuste_nombre})</option>
            ))}
          </select>
          <span className={styles.hint}>
            {referenceHint} {references && references.length === 0 && 'No hay referencias activas.'}
          </span>
          {referencesError && <span className={styles.fieldError}>{referencesError}</span>}
          {err('referencia')}
        </div>

        <div className={styles.field}>
          <label htmlFor="sal-resultado">Modelo a crear</label>
          <div className={styles.inline}>
            <select id="sal-resultado" value={form.producto_resultado} onChange={set('producto_resultado')} required>
              <option value="">Selecciona</option>
              {outputProducts.map((p) => (
                <option key={p.id} value={p.id}>{p.nombre}</option>
              ))}
            </select>
          </div>
          <span className={styles.hint}>
            Modelo de jean que se obtendrá al volver de lavandería (entrará en Ingreso). ¿No está? Créalo en el{' '}
            <Link to="/inventario/catalogo" className={styles.textLink}>Catálogo</Link>.
          </span>
          {err('producto_resultado')}
        </div>
      </div>

      <div>
        <h3 className={styles.subhead}>Pantalones que se envían</h3>
        <p className={styles.muted}>
          Solo viajan las prendas cosidas. Los botones y remaches se colocan después, en terminación, y los químicos los pone la lavandería.
        </p>
      </div>

      <div className={styles.basketAdd}>
        <label className={styles.field}>
          Pantalón genérico
          <select value={pick.producto} onChange={(e) => setPick((c) => ({ ...c, producto: e.target.value }))}>
            <option value="">Selecciona</option>
            {garments.map((p) => (
              <option key={p.id} value={p.id}>{p.nombre} (hay {formatQty(p.stock_actual, p.unidad)})</option>
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
        <button type="button" className={styles.secondaryBtn} onClick={addToBasket}>Agregar a la orden</button>
      </div>
      {pickError && <span className={styles.fieldError}>{pickError}</span>}

      {basket.length === 0 ? (
        <p className={styles.empty}>Agrega los pantalones genéricos que se envían a lavandería.</p>
      ) : (
        <div className={styles.tableWrap}>
          <table className={`${styles.table} ${styles.basketTable}`}>
            <thead>
              <tr>
                <th>Producto</th>
                <th className={styles.num}>Disponible</th>
                <th>Cantidad a enviar</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {basket.map((line) => {
                const product = productOf(line.producto)
                const short = isShort(line, product)
                return (
                  <tr key={line.producto} className={short ? styles.rowShort : ''}>
                    <td>
                      {product.nombre}
                      <span className={styles.muted}> · {typeLabel(product.tipo)}</span>
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
          type="submit" className={styles.primaryBtn} disabled={saving || problems.length > 0}
          title={problems.length ? problems.join(' ') : undefined}
        >
          {saving ? 'Guardando…' : `Registrar orden ${PREFIX}`}
        </button>
      </div>
    </form>
  )
}
