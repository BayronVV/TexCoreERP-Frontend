import { useEffect, useMemo, useState } from 'react'
import { apiGet, apiRequest } from '../../api/client'
import { useToast } from '../ui/toastContext'
import Modal from '../ui/Modal'
import { fieldErrors, formatQty } from '../Inventory/labels'
import styles from '../Inventory/Inventory.module.css'
import refStyles from './References.module.css'
import {
  MATERIAL_TYPES, emptyRow, formatBytes, grossPerGarment, isWhole, rowsFromLines, tableProblems, toPayload, usedByOthers,
} from './fichaRows'

const DOCUMENT_MAX_BYTES = 5 * 1024 * 1024
const base = (reference) => `/api/referencias/${reference.id}/ficha/`

// Ficha técnica de consumo por unidad de una referencia (HU 3.2): qué materiales y cuánto lleva una prenda, con su merma.
// Las filas se arman aquí y se envían juntas como una lista estructurada. Aparte se puede adjuntar el PDF de la ficha
// extensa (geometral, secuencia de confección, tabla de medidas), que todavía no tiene módulo propio.
export default function FichaForm({ reference, meta, canManage, onClose }) {
  const notify = useToast()
  const [ficha, setFicha] = useState(null) // lo que hay guardado en el servidor
  const [products, setProducts] = useState(null)
  const [rows, setRows] = useState([])
  const [lavado, setLavado] = useState('')
  const [notas, setNotas] = useState('')
  const [loadError, setLoadError] = useState('')
  const [errors, setErrors] = useState({})
  const [saving, setSaving] = useState(false)
  const [busyDocument, setBusyDocument] = useState(false)
  const [documentError, setDocumentError] = useState('')
  const [touched, setTouched] = useState(false)

  const fill = (data) => {
    setFicha(data)
    setRows(rowsFromLines(data.lineas))
    setLavado(data.lavado)
    setNotas(data.notas)
  }

  useEffect(() => {
    let alive = true
    Promise.all([apiGet(base(reference)), apiGet('/api/inventario/catalogo/')])
      .then(([data, catalog]) => {
        if (!alive) return
        fill(data)
        setProducts(catalog.filter((p) => MATERIAL_TYPES.includes(p.tipo)))
      })
      .catch((error) => alive && setLoadError(error.message))
    return () => {
      alive = false
    }
  }, [reference])

  const byId = useMemo(() => new Map((products ?? []).map((p) => [String(p.id), p])), [products])
  const productOf = (id) => byId.get(String(id))
  const problems = tableProblems(rows, productOf)
  const valid = problems.general.length === 0 && problems.byRow.every((list) => list.length === 0)

  const updateRow = (index, patch) => {
    setTouched(true)
    setRows((current) => current.map((row, i) => (i === index ? { ...row, ...patch } : row)))
  }
  const pickProduct = (index, value) => {
    const product = productOf(value)
    // Al cambiar de material se ajusta la merma si la unidad no la admite.
    updateRow(index, { producto: value, ...(product && isWhole(product.unidad) ? { merma: '0' } : {}) })
  }
  const removeRow = (index) => {
    setTouched(true)
    setRows((current) => current.filter((_, i) => i !== index))
  }

  const save = async (event) => {
    event.preventDefault()
    setTouched(true)
    if (!valid) return
    setSaving(true)
    setErrors({})
    try {
      const saved = await apiRequest(base(reference), { method: 'PUT', body: toPayload({ lavado, notas, rows }) })
      fill(saved)
      setTouched(false)
      notify(`Ficha técnica de ${reference.codigo} guardada.`)
    } catch (error) {
      setErrors(fieldErrors(error))
    }
    setSaving(false)
  }

  const removeFicha = async () => {
    if (!window.confirm(`¿Quitar la ficha técnica de ${reference.nombre}? Se pierden sus materiales y el PDF adjunto.`)) return
    try {
      await apiRequest(base(reference), { method: 'DELETE' })
      notify('Ficha técnica quitada.')
      onClose()
    } catch (error) {
      setErrors(fieldErrors(error))
    }
  }

  const uploadDocument = async (event) => {
    const file = event.target.files[0]
    event.target.value = ''
    if (!file) return
    setDocumentError('')
    if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) return setDocumentError('Solo se aceptan archivos PDF.')
    if (file.size > DOCUMENT_MAX_BYTES) return setDocumentError(`El PDF pesa más de ${DOCUMENT_MAX_BYTES / (1024 * 1024)} MB.`)
    setBusyDocument(true)
    try {
      const data = new FormData()
      data.append('documento', file, file.name)
      const saved = await apiRequest(`${base(reference)}documento/`, { method: 'POST', body: data })
      setFicha((current) => ({ ...current, documento: saved.documento }))
      notify('PDF de la ficha adjuntado.')
    } catch (error) {
      setDocumentError(fieldErrors(error).documento ?? error.message)
    }
    setBusyDocument(false)
  }

  const openDocument = async () => {
    setDocumentError('')
    try {
      const blob = await apiRequest(`${base(reference)}documento/`, { blob: true })
      const url = URL.createObjectURL(blob)
      window.open(url, '_blank', 'noopener')
      setTimeout(() => URL.revokeObjectURL(url), 60000)
    } catch (error) {
      setDocumentError(error.message)
    }
  }

  const removeDocument = async () => {
    if (!window.confirm('¿Quitar el PDF de la ficha técnica?')) return
    setBusyDocument(true)
    try {
      const saved = await apiRequest(`${base(reference)}documento/`, { method: 'DELETE' })
      setFicha((current) => ({ ...current, documento: saved.documento }))
      notify('PDF quitado.')
    } catch (error) {
      setDocumentError(fieldErrors(error).documento ?? error.message)
    }
    setBusyDocument(false)
  }

  const ready = ficha && products
  const document = ficha?.documento

  return (
    <Modal title={`Ficha técnica · ${reference.codigo} ${reference.nombre}`} onClose={onClose} wide>
      {loadError && <p className={styles.formError}>{loadError}</p>}
      {!loadError && !ready && <p className={styles.muted}>Cargando la ficha…</p>}
      {ready && (
        <form className={styles.form} onSubmit={save}>
          <p className={styles.muted}>
            Cuánto lleva <strong>una prenda</strong> de esta referencia. La merma (por ejemplo el desperdicio de corte de la tela)
            se suma una sola vez al calcular el consumo de una orden. Las piezas enteras (botones, cierres, remaches) no llevan merma.
          </p>

          <div className={styles.grid}>
            <label className={styles.field}>
              Tipo de lavado (opcional)
              <select value={lavado} onChange={(e) => { setTouched(true); setLavado(e.target.value) }} disabled={!canManage}>
                <option value="">Sin definir</option>
                {meta.lavados.map((w) => <option key={w.value} value={w.value}>{w.label}</option>)}
              </select>
              {errors.lavado && <span className={styles.fieldError}>{errors.lavado}</span>}
            </label>
            <label className={styles.field}>
              Notas de la ficha (opcional)
              <input
                value={notas} onChange={(e) => { setTouched(true); setNotas(e.target.value) }} maxLength={500}
                disabled={!canManage} placeholder="Ej. Costura de seguridad en los costados"
              />
            </label>
          </div>

          <div>
            <h3 className={styles.subhead}>Materiales por prenda</h3>
            {rows.length === 0 ? (
              <p className={styles.empty}>Todavía no hay materiales. {canManage ? 'Agrega el primero.' : ''}</p>
            ) : (
              <div className={styles.tableWrap}>
                <table className={`${styles.table} ${refStyles.fichaTable}`}>
                  <thead>
                    <tr>
                      <th>Material</th>
                      <th>Cantidad por prenda</th>
                      <th>Merma %</th>
                      <th className={styles.num}>Con merma</th>
                      <th>Observaciones</th>
                      {canManage && <th />}
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row, index) => {
                      const product = productOf(row.producto)
                      const used = usedByOthers(rows, index)
                      const gross = grossPerGarment(row)
                      const list = problems.byRow[index]
                      return (
                        <tr key={index} className={touched && list.length ? styles.rowShort : ''}>
                          <td>
                            <select
                              value={row.producto} onChange={(e) => pickProduct(index, e.target.value)}
                              disabled={!canManage} aria-label={`Material ${index + 1}`}
                            >
                              <option value="">Selecciona</option>
                              {products.map((p) => (
                                <option key={p.id} value={p.id} disabled={used.has(String(p.id))}>
                                  {p.nombre} ({p.unidad})
                                </option>
                              ))}
                            </select>
                            {touched && list.length > 0 && <div className={styles.shortText}>{list[0]}</div>}
                          </td>
                          <td>
                            <input
                              type="number" min="0" step={product ? (isWhole(product.unidad) ? '1' : '0.001') : '0.001'}
                              value={row.cantidad} onChange={(e) => updateRow(index, { cantidad: e.target.value })}
                              disabled={!canManage} aria-label={`Cantidad por prenda ${index + 1}`}
                            />{' '}
                            {product?.unidad}
                          </td>
                          <td>
                            <input
                              type="number" min="0" max="50" step="0.01" value={row.merma}
                              onChange={(e) => updateRow(index, { merma: e.target.value })}
                              disabled={!canManage || (product && isWhole(product.unidad))} aria-label={`Merma ${index + 1}`}
                            />
                          </td>
                          <td className={styles.num}>{gross === null || !product ? '—' : formatQty(gross, product.unidad)}</td>
                          <td>
                            <input
                              value={row.observaciones} onChange={(e) => updateRow(index, { observaciones: e.target.value })}
                              maxLength={120} disabled={!canManage} placeholder="Opcional" aria-label={`Observaciones ${index + 1}`}
                            />
                          </td>
                          {canManage && (
                            <td>
                              <button type="button" className={`${styles.linkBtn} ${styles.dangerText}`} onClick={() => removeRow(index)}>
                                Quitar
                              </button>
                            </td>
                          )}
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
            {touched && problems.general.map((message) => <span key={message} className={styles.fieldError}>{message}</span>)}
            {errors.lineas && <span className={styles.fieldError}>{errors.lineas}</span>}
            {canManage && (
              <button
                type="button" className={styles.secondaryBtn}
                onClick={() => { setTouched(true); setRows((current) => [...current, emptyRow()]) }}
                disabled={rows.length >= 50}
              >
                + Agregar material
              </button>
            )}
            {products.length === 0 && (
              <p className={styles.muted}>No hay materias primas ni insumos en el catálogo de inventario.</p>
            )}
          </div>

          <div className={refStyles.documentBox}>
            <h3 className={styles.subhead}>Ficha técnica extensa (PDF)</h3>
            <p className={styles.muted}>
              Para el geometral, la secuencia de confección y la tabla de medidas, que todavía no tienen módulo propio.
              Un PDF de hasta 5 MB.
            </p>
            {!ficha.existe ? (
              <p className={styles.hint}>Guarda primero la ficha con sus materiales; después podrás adjuntar el PDF.</p>
            ) : (
              <div className={refStyles.documentRow}>
                {document ? (
                  <>
                    <span>
                      <strong>{document.nombre}</strong> <span className={styles.muted}>· {formatBytes(document.tamano)}</span>
                    </span>
                    <button type="button" className={styles.linkBtn} onClick={openDocument} disabled={busyDocument}>Ver PDF</button>
                  </>
                ) : (
                  <span className={styles.muted}>No hay PDF adjunto.</span>
                )}
                {canManage && (
                  <>
                    <label className={styles.secondaryBtn}>
                      {document ? 'Reemplazar PDF' : 'Adjuntar PDF'}
                      <input type="file" accept="application/pdf,.pdf" onChange={uploadDocument} hidden disabled={busyDocument} />
                    </label>
                    {document && (
                      <button type="button" className={`${styles.linkBtn} ${styles.dangerText}`} onClick={removeDocument} disabled={busyDocument}>
                        Quitar PDF
                      </button>
                    )}
                  </>
                )}
              </div>
            )}
            {documentError && <span className={styles.fieldError}>{documentError}</span>}
          </div>

          {errors.detail && <p className={styles.formError}>{errors.detail}</p>}
          {ficha.existe && ficha.actualizado_por_nombre && (
            <p className={styles.hint}>Última actualización: {ficha.actualizado_por_nombre}.</p>
          )}
          <div className={styles.actions}>
            {canManage && ficha.existe && (
              <button type="button" className={`${styles.linkBtn} ${styles.dangerText}`} onClick={removeFicha}>Quitar ficha</button>
            )}
            <button type="button" className={styles.secondaryBtn} onClick={onClose}>Cerrar</button>
            {canManage && (
              <button type="submit" className={styles.primaryBtn} disabled={saving || (touched && !valid)}>
                {saving ? 'Guardando…' : 'Guardar ficha'}
              </button>
            )}
          </div>
        </form>
      )}
    </Modal>
  )
}
