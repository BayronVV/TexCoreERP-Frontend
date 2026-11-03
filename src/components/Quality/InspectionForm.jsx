import { useEffect, useMemo, useState } from 'react'
import { apiGet, apiRequest } from '../../api/client'
import { useToast } from '../ui/toastContext'
import Modal from '../ui/Modal'
import { fieldErrors } from '../Inventory/labels'
import styles from '../Inventory/Inventory.module.css'
import qualityStyles from './Quality.module.css'
import {
  addDefectRow, availableDefects, balance, confirmationText, defectKindLabel, inspectionBody, inspectionProblems, removeDefectRow,
} from './quality'

// Inspección de un lote que volvió de lavandería: cuántas prendas son aptas y cuántas marras, con el desglose por defecto.
// La suma debe cuadrar exacto con lo recibido (el botón espera a que cuadre) y no se puede editar después de guardar.
export default function InspectionForm({ lot, onSaved, onClose }) {
  const notify = useToast()
  const [defects, setDefects] = useState([])
  const [aptas, setAptas] = useState('')
  const [rows, setRows] = useState([])
  const [pick, setPick] = useState({ defecto: '', cantidad: '', nota: '' })
  const [pickError, setPickError] = useState('')
  const [observaciones, setObservaciones] = useState('')
  const [errors, setErrors] = useState({})
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    apiGet('/api/calidad/defectos/?activo=true&limit=200').then(setDefects).catch((error) => setErrors({ detail: error.message }))
  }, [])

  const choices = useMemo(() => availableDefects(defects, rows), [defects, rows])
  const sum = balance(lot.cantidad_recibida, aptas, rows)
  const problems = inspectionProblems({ lot, aptas, rows })

  const add = () => {
    const defect = defects.find((item) => String(item.id) === pick.defecto)
    const result = addDefectRow(rows, defect, pick.cantidad, pick.nota)
    if (result.error) return setPickError(result.error)
    setRows(result.rows)
    setPick({ defecto: '', cantidad: '', nota: '' })
    setPickError('')
  }

  const changeQuantity = (defectId, value) =>
    setRows((current) => current.map((row) => (row.defecto === defectId ? { ...row, cantidad: value } : row)))

  const submit = async (event) => {
    event.preventDefault()
    if (problems.length) return setErrors({ detail: problems[0] })
    if (!window.confirm(confirmationText({ lot, aptas, rows }))) return
    setSaving(true)
    setErrors({})
    try {
      const saved = await apiRequest('/api/calidad/inspecciones/', { method: 'POST', body: inspectionBody({ lot, aptas, rows, observaciones }) })
      notify(`Inspección ${saved.codigo} registrada.`)
      onSaved(saved)
    } catch (error) {
      setErrors(fieldErrors(error))
      setSaving(false)
    }
  }

  const err = (name) => errors[name] && <span className={styles.fieldError}>{errors[name]}</span>

  return (
    <Modal title={`Inspeccionar el lote ${lot.codigo}`} onClose={onClose} wide>
      <form className={styles.form} onSubmit={submit} noValidate>
        <dl className={qualityStyles.lotInfo}>
          <div><dt>Orden</dt><dd>{lot.orden_codigo}</dd></div>
          <div><dt>Referencia</dt><dd>{lot.referencia_nombre}</dd></div>
          <div><dt>Lavandería</dt><dd>{lot.lavanderia_nombre}</dd></div>
          <div><dt>Recibidas conformes</dt><dd><strong>{lot.cantidad_recibida}</strong> prendas</dd></div>
        </dl>

        <label className={styles.field}>
          Prendas aptas (primera calidad)
          <input
            className={qualityStyles.smallInput} value={aptas} onChange={(event) => setAptas(event.target.value)}
            inputMode="numeric" placeholder="0" aria-label="Prendas aptas"
          />
          {err('aptas')}
        </label>

        <p className={styles.subhead}>Marras por defecto</p>
        <div className={qualityStyles.pickRow}>
          <label className={styles.field}>
            Defecto
            <select value={pick.defecto} onChange={(event) => setPick({ ...pick, defecto: event.target.value })}>
              <option value="">Selecciona</option>
              {choices.map((defect) => <option key={defect.id} value={defect.id}>{defect.nombre} ({defectKindLabel(defect).toLowerCase()})</option>)}
            </select>
          </label>
          <label className={styles.field}>
            Cantidad
            <input value={pick.cantidad} onChange={(event) => setPick({ ...pick, cantidad: event.target.value })} inputMode="numeric" placeholder="0" />
          </label>
          <label className={styles.field}>
            Nota (opcional)
            <input value={pick.nota} onChange={(event) => setPick({ ...pick, nota: event.target.value })} maxLength={255} placeholder="Dónde se vio" />
          </label>
          <button type="button" className={styles.secondaryBtn} onClick={add}>+ Agregar</button>
        </div>
        {pickError && <span className={styles.fieldError} role="alert">{pickError}</span>}
        {err('defectos')}

        {rows.length === 0 ? (
          <p className={styles.empty}>Sin marras: todas las prendas recibidas serían aptas.</p>
        ) : (
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead><tr><th>Defecto</th><th>Tipo</th><th className={styles.num}>Cantidad</th><th>Nota</th><th /></tr></thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.defecto}>
                    <td>{row.nombre}</td>
                    <td><span className={`${styles.badge} ${row.corregible ? styles.badgeWarn : styles.badgeDanger}`}>{row.corregible ? 'Corregible' : 'Incorregible'}</span></td>
                    <td className={styles.num}>
                      <input
                        className={qualityStyles.smallInput} value={row.cantidad} inputMode="numeric"
                        onChange={(event) => changeQuantity(row.defecto, event.target.value)} aria-label={`Cantidad de ${row.nombre}`}
                      />
                    </td>
                    <td className={qualityStyles.noteCell}>{row.nota || '—'}</td>
                    <td><button type="button" className={`${styles.linkBtn} ${styles.dangerText}`} onClick={() => setRows(removeDefectRow(rows, row.defecto))}>Quitar</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className={`${qualityStyles.balance} ${sum.ok ? qualityStyles.balanceOk : qualityStyles.balanceWarn}`} role="status">
          <span>{sum.good} aptas + {sum.flawed} marras = {sum.sum} de {lot.cantidad_recibida}</span>
          <span>{sum.message}</span>
        </div>

        <label className={styles.field}>
          Observaciones (opcional)
          <input value={observaciones} onChange={(event) => setObservaciones(event.target.value)} maxLength={500} />
        </label>

        {errors.detail && <p className={styles.formError}>{errors.detail}</p>}
        {err('lote')}
        <div className={styles.actions}>
          <button type="button" className={styles.secondaryBtn} onClick={onClose}>Cancelar</button>
          <button type="submit" className={styles.primaryBtn} disabled={saving || problems.length > 0} title={problems[0] ?? ''}>
            {saving ? 'Guardando…' : 'Registrar inspección'}
          </button>
        </div>
      </form>
    </Modal>
  )
}
