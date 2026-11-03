import { useMemo, useState } from 'react'
import { apiRequest } from '../../api/client'
import { useToast } from '../ui/toastContext'
import Modal from '../ui/Modal'
import { fieldErrors } from '../Inventory/labels'
import styles from '../Inventory/Inventory.module.css'
import finishedStyles from './Finished.module.css'
import { balance, confirmationText, entryBody, entryProblems, initialQuantities, plannedMap, variantMatrix } from './finished'

// Ingreso de las aptas de una inspección al inventario final: se reparten por talla y color en una matriz y la suma debe cuadrar
// exacto con las aptas (el botón espera a que cuadre). Lo planificado en el lote se muestra solo como referencia.
export default function EntryForm({ pending, onSaved, onClose }) {
  const notify = useToast()
  const [quantities, setQuantities] = useState(() => initialQuantities(pending))
  const [ubicacion, setUbicacion] = useState('')
  const [observaciones, setObservaciones] = useState('')
  const [errors, setErrors] = useState({})
  const [saving, setSaving] = useState(false)

  const matrix = useMemo(() => variantMatrix(pending.variantes), [pending])
  const planned = useMemo(() => plannedMap(pending), [pending])
  const hasPlan = Object.keys(planned).length > 0
  const state = balance(pending.aptas, quantities)
  const problems = entryProblems({ pending, quantities })

  const set = (variantId, value) => setQuantities((current) => ({ ...current, [variantId]: value }))

  const submit = async (event) => {
    event.preventDefault()
    if (problems.length) return setErrors({ detail: problems[0] })
    if (!window.confirm(confirmationText(pending, quantities))) return
    setSaving(true)
    setErrors({})
    try {
      const saved = await apiRequest('/api/terminado/ingresos/', { method: 'POST', body: entryBody({ pending, quantities, ubicacion, observaciones }) })
      notify(`Ingreso ${saved.codigo} registrado.`)
      onSaved(saved)
    } catch (error) {
      setErrors(fieldErrors(error))
      setSaving(false)
    }
  }

  const err = (name) => errors[name] && <span className={styles.fieldError}>{errors[name]}</span>

  return (
    <Modal title={`Ingresar el lote ${pending.lote_codigo}`} onClose={onClose} wide>
      <form className={styles.form} onSubmit={submit} noValidate>
        <dl className={finishedStyles.lotInfo}>
          <div><dt>Inspección</dt><dd>{pending.inspeccion_codigo}</dd></div>
          <div><dt>Orden</dt><dd>{pending.orden_codigo}</dd></div>
          <div><dt>Referencia</dt><dd>{pending.referencia_nombre}</dd></div>
          <div><dt>Aptas por ingresar</dt><dd><strong>{pending.aptas}</strong> prendas</dd></div>
        </dl>
        {pending.marras > 0 && <p className={finishedStyles.note}>Las {pending.marras} marras de esta inspección no entran a este inventario.</p>}

        <p className={styles.subhead}>Reparto por talla y color</p>
        <div className={finishedStyles.matrixWrap}>
          <table className={finishedStyles.matrix}>
            <thead>
              <tr><th>Color</th>{matrix.sizes.map((size) => <th key={size}>Talla {size}</th>)}</tr>
            </thead>
            <tbody>
              {matrix.rows.map((row) => (
                <tr key={row.color}>
                  <th scope="row">{row.color}</th>
                  {matrix.sizes.map((size) => {
                    const variant = row.cells[size]
                    if (!variant) return <td key={size} className={finishedStyles.cellMissing}>—</td>
                    return (
                      <td key={size}>
                        <input
                          className={finishedStyles.cellInput} value={quantities[variant.id] ?? ''} inputMode="numeric" placeholder="0"
                          onChange={(event) => set(variant.id, event.target.value)} aria-label={`Talla ${size} ${row.color}`}
                        />
                        {hasPlan && planned[variant.id] !== undefined && <span className={finishedStyles.plan}>plan {planned[variant.id]}</span>}
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {err('lineas')}

        <div className={`${finishedStyles.balance} ${state.ok ? finishedStyles.balanceOk : finishedStyles.balanceWarn}`} role="status">
          <span>{state.sum} de {pending.aptas} aptas repartidas</span>
          <span>{state.message}</span>
        </div>

        <div className={styles.grid}>
          <label className={styles.field}>
            Ubicación en bodega (opcional)
            <input value={ubicacion} onChange={(event) => setUbicacion(event.target.value)} maxLength={80} placeholder="Ej. Estante A2" />
            {err('ubicacion')}
          </label>
          <label className={styles.field}>
            Observaciones (opcional)
            <input value={observaciones} onChange={(event) => setObservaciones(event.target.value)} maxLength={500} />
          </label>
        </div>

        {errors.detail && <p className={styles.formError}>{errors.detail}</p>}
        {err('inspeccion')}
        <div className={styles.actions}>
          <button type="button" className={styles.secondaryBtn} onClick={onClose}>Cancelar</button>
          <button type="submit" className={styles.primaryBtn} disabled={saving || problems.length > 0} title={problems[0] ?? ''}>
            {saving ? 'Guardando…' : 'Registrar ingreso'}
          </button>
        </div>
      </form>
    </Modal>
  )
}
