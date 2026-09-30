import { useMemo, useState } from 'react'
import { apiRequest } from '../../api/client'
import { useToast } from '../ui/toastContext'
import EvidencePicker from './EvidencePicker'
import ProductModal from './ProductModal'
import { uploadEvidence } from './evidence'
import {
  ORDER_TYPES, PURCHASED, WHOLE_UNITS, fieldErrors, formatQty, todayISO, typeLabel,
} from './labels'
import styles from './Inventory.module.css'

// Qué puede llevar la cesta y qué producto resulta, según el tipo de orden.
const RULES = {
  PRODUCCION: {
    inputs: PURCHASED,
    output: 'GENERICO',
    outputHelp: 'Pantalón genérico que se obtiene al terminar (entrará en Ingreso).',
    basketHelp: 'Tela, hilo, cierres y demás insumos que se usan para armar el pantalón genérico.',
  },
  LAVANDERIA: {
    inputs: [...PURCHASED, 'GENERICO'],
    output: 'TERMINADO',
    outputHelp: 'Modelo de jean que se obtendrá al volver de lavandería (entrará en Ingreso).',
    basketHelp: 'Los pantalones genéricos que se envían, más botones, remaches y demás insumos de detalle.',
  },
}

const EMPTY = {
  fecha_salida: todayISO(), responsable: '', destino: '', ficha_tecnica: '',
  producto_resultado: '', cantidad_prendas: '', observaciones: '',
}

export default function ExitForm({ products, onChanged }) {
  const notify = useToast()
  const [tipo, setTipo] = useState('PRODUCCION')
  const [form, setForm] = useState(EMPTY)
  const [basket, setBasket] = useState([]) // [{ producto, cantidad }]
  const [pick, setPick] = useState({ producto: '', cantidad: '' })
  const [pickError, setPickError] = useState('')
  const [files, setFiles] = useState([])
  const [errors, setErrors] = useState({})
  const [shortages, setShortages] = useState([])
  const [saving, setSaving] = useState(false)
  const [creating, setCreating] = useState(false)

  const rules = RULES[tipo]
  const prefix = ORDER_TYPES.find((t) => t.value === tipo).prefix
  const byId = useMemo(() => new Map(products.map((p) => [String(p.id), p])), [products])
  const inputProducts = products.filter((p) => rules.inputs.includes(p.tipo))
  const outputProducts = products.filter((p) => p.tipo === rules.output)

  const set = (field) => (event) => setForm((current) => ({ ...current, [field]: event.target.value }))

  const changeType = (event) => {
    setTipo(event.target.value)
    setBasket([])
    setPick({ producto: '', cantidad: '' })
    setForm((current) => ({ ...current, producto_resultado: '', cantidad_prendas: '', destino: '' }))
    setErrors({})
    setShortages([])
  }

  const step = (product) => (WHOLE_UNITS.includes(product?.unidad) ? '1' : '0.01')
  const lineProduct = (line) => byId.get(String(line.producto))
  const isShort = (line) => Number(line.cantidad) > Number(lineProduct(line)?.stock_actual ?? 0)

  const addToBasket = () => {
    const product = byId.get(String(pick.producto))
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

  const genericLine = basket.find((l) => lineProduct(l)?.tipo === 'GENERICO')
  const anyShort = basket.some(isShort)
  const anyInvalid = basket.some((l) => !(Number(l.cantidad) > 0))
  const missingGeneric = tipo === 'LAVANDERIA' && !genericLine
  const canSubmit = basket.length > 0 && !anyShort && !anyInvalid && !missingGeneric && form.producto_resultado

  const submit = async (event) => {
    event.preventDefault()
    setSaving(true)
    setErrors({})
    setShortages([])
    let order
    try {
      order = await apiRequest('/api/inventario/ordenes/', {
        method: 'POST',
        body: {
          ...form,
          tipo,
          cantidad_prendas: tipo === 'PRODUCCION' && form.cantidad_prendas ? form.cantidad_prendas : null,
          lineas: basket,
        },
      })
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
    setForm({ ...EMPTY, fecha_salida: todayISO() })
    setBasket([])
    setFiles([])
    setSaving(false)
    onChanged()
  }

  const err = (name) => errors[name] && <span className={styles.fieldError}>{errors[name]}</span>

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
          <label className={styles.field}>
            Ficha técnica
            <input value={form.ficha_tecnica} onChange={set('ficha_tecnica')} maxLength={60} required placeholder="Código de la ficha" />
            <span className={styles.hint}>Es el lote con el que volverá al inventario.</span>
            {err('ficha_tecnica')}
          </label>
          <div className={styles.field}>
            <label htmlFor="sal-resultado">{tipo === 'PRODUCCION' ? 'Se producirá' : 'Modelo a crear'}</label>
            <div className={styles.inline}>
              <select id="sal-resultado" value={form.producto_resultado} onChange={set('producto_resultado')} required>
                <option value="">Selecciona</option>
                {outputProducts.map((p) => (
                  <option key={p.id} value={p.id}>{p.nombre}</option>
                ))}
              </select>
              <button type="button" className={styles.secondaryBtn} onClick={() => setCreating(true)}>+ Crear</button>
            </div>
            <span className={styles.hint}>{rules.outputHelp}</span>
            {err('producto_resultado')}
          </div>
          {tipo === 'PRODUCCION' && (
            <label className={styles.field}>
              Pantalones a producir (opcional)
              <input type="number" min="1" step="1" value={form.cantidad_prendas} onChange={set('cantidad_prendas')} />
              {err('cantidad_prendas')}
            </label>
          )}
        </div>

        <div>
          <h3 className={styles.subhead}>Cesta de la orden</h3>
          <p className={styles.muted}>{rules.basketHelp}</p>
        </div>

        <div className={styles.basketAdd}>
          <label className={styles.field}>
            Producto
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
            Cantidad {byId.get(String(pick.producto)) ? `(${byId.get(String(pick.producto)).unidad})` : ''}
            <input
              type="number" min="0" step={step(byId.get(String(pick.producto)))} value={pick.cantidad}
              onChange={(e) => setPick((c) => ({ ...c, cantidad: e.target.value }))}
              onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addToBasket())}
            />
          </label>
          <button type="button" className={styles.secondaryBtn} onClick={addToBasket}>Agregar a la cesta</button>
        </div>
        {pickError && <span className={styles.fieldError}>{pickError}</span>}

        {basket.length === 0 ? (
          <p className={styles.empty}>La cesta está vacía. Agrega los productos que salen en esta orden.</p>
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
                  const short = isShort(line)
                  return (
                    <tr key={line.producto} className={short ? styles.rowShort : ''}>
                      <td>
                        {product.nombre}
                        <span className={styles.muted}> · {typeLabel(product.tipo)}</span>
                      </td>
                      <td className={styles.num}>{formatQty(product.stock_actual, product.unidad)}</td>
                      <td>
                        <input
                          type="number" min="0" step={step(product)} value={line.cantidad}
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
        {missingGeneric && basket.length > 0 && (
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
          <button
            type="button" className={styles.secondaryBtn}
            onClick={() => { setForm({ ...EMPTY, fecha_salida: todayISO() }); setBasket([]); setFiles([]); setErrors({}); setShortages([]) }}
          >
            Limpiar
          </button>
          <button type="submit" className={styles.primaryBtn} disabled={saving || !canSubmit}>
            {saving ? 'Guardando…' : `Registrar orden ${prefix}`}
          </button>
        </div>
      </form>

      {creating && (
        <ProductModal
          allowedTypes={[rules.output]}
          defaultType={rules.output}
          onClose={() => setCreating(false)}
          onSaved={(saved) => {
            setCreating(false)
            onChanged()
            setForm((current) => ({ ...current, producto_resultado: String(saved.id) }))
          }}
        />
      )}
    </>
  )
}
