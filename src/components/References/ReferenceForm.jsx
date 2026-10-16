import { useEffect, useRef, useState } from 'react'
import { apiRequest } from '../../api/client'
import { useToast } from '../ui/toastContext'
import Modal from '../ui/Modal'
import AuthImage from '../Inventory/AuthImage'
import { shrinkImage } from '../Inventory/imageTools'
import { fieldErrors } from '../Inventory/labels'
import styles from '../Inventory/Inventory.module.css'
import refStyles from './References.module.css'
import { addCombinations, removeVariant, sortVariants } from './variants'

const imagePath = (image) => `/api/referencias/imagenes/${image.id}/archivo/`

// Alta y edición de una referencia de jean: datos del diseño, tallas y colores, y fotos del prototipo.
// Las fotos nuevas se reducen y se previsualizan aquí; se envían juntas (FormData) cuando se guarda la referencia.
export default function ReferenceForm({ reference, meta, onSaved, onClose }) {
  const notify = useToast()
  const editing = Boolean(reference)
  const [form, setForm] = useState({
    nombre: reference?.nombre ?? '',
    ajuste: reference?.ajuste ?? '',
    descripcion: reference?.descripcion ?? '',
  })
  const [variants, setVariants] = useState(() =>
    sortVariants((reference?.variantes ?? []).map(({ talla, color }) => ({ talla, color }))),
  )
  const [sizesText, setSizesText] = useState('')
  const [colorsText, setColorsText] = useState('')
  const [comboNote, setComboNote] = useState('')
  const [saved, setSaved] = useState(reference) // la referencia tal como está en el servidor
  const [queued, setQueued] = useState([]) // fotos nuevas: { key, blob, preview }
  const [imageError, setImageError] = useState('')
  const [errors, setErrors] = useState({})
  const [saving, setSaving] = useState(false)
  const [busyImage, setBusyImage] = useState(false)
  const previewsRef = useRef([])

  useEffect(() => () => previewsRef.current.forEach((url) => URL.revokeObjectURL(url)), [])

  const stored = saved?.imagenes ?? []
  const room = meta.max_imagenes - stored.length - queued.length
  const set = (field) => (event) => setForm((current) => ({ ...current, [field]: event.target.value }))

  const addCombos = () => {
    const result = addCombinations(variants, sizesText, colorsText, meta.max_variantes)
    setVariants(result.variants)
    if (result.added) {
      setSizesText('')
      setColorsText('')
    }
    setComboNote(
      result.overflow
        ? `Máximo ${meta.max_variantes} combinaciones por referencia.`
        : !result.added && !result.skipped
          ? 'Escribe al menos una talla y un color.'
          : result.skipped
            ? `${result.skipped} ya estaba${result.skipped > 1 ? 'n' : ''} en la lista.`
            : '',
    )
  }

  const pickImages = async (event) => {
    const files = [...event.target.files]
    event.target.value = ''
    if (!files.length) return
    setImageError('')
    const accepted = files.slice(0, Math.max(room, 0))
    const next = []
    try {
      for (const file of accepted) {
        const blob = await shrinkImage(file)
        const preview = URL.createObjectURL(blob)
        previewsRef.current.push(preview)
        next.push({ key: `${file.name}-${preview}`, blob, preview })
      }
    } catch (error) {
      setImageError(error.message)
    }
    setQueued((current) => [...current, ...next])
    if (files.length > accepted.length) {
      setImageError(`Solo caben ${meta.max_imagenes} imágenes por referencia: se omitieron ${files.length - accepted.length}.`)
    }
  }

  const dropQueued = (key) => setQueued((current) => current.filter((item) => item.key !== key))

  // Cambiar o quitar una foto ya guardada se aplica de inmediato; no espera al botón de guardar.
  const changeStored = async (image, action) => {
    setBusyImage(true)
    setImageError('')
    try {
      const url = action === 'main' ? `/api/referencias/imagenes/${image.id}/principal/` : `/api/referencias/imagenes/${image.id}/archivo/`
      setSaved(await apiRequest(url, { method: action === 'main' ? 'POST' : 'DELETE' }))
    } catch (error) {
      setImageError(fieldErrors(error).imagen ?? error.message)
    }
    setBusyImage(false)
  }

  const submit = async (event) => {
    event.preventDefault()
    setSaving(true)
    setErrors({})
    const body = { nombre: form.nombre, ajuste: form.ajuste, descripcion: form.descripcion, variantes: variants }
    let result
    try {
      result = await apiRequest(editing ? `/api/referencias/${reference.id}/` : '/api/referencias/', {
        method: editing ? 'PATCH' : 'POST',
        body,
      })
    } catch (error) {
      setErrors(fieldErrors(error))
      setSaving(false)
      return
    }
    // La referencia ya quedó guardada; si las fotos fallan se avisa sin repetir el guardado.
    try {
      if (queued.length) {
        const data = new FormData()
        queued.forEach((item, index) => data.append('imagen', item.blob, `prototipo-${index + 1}.jpg`))
        result = await apiRequest(`/api/referencias/${result.id}/imagenes/`, { method: 'POST', body: data })
      }
      notify(editing ? 'Referencia actualizada.' : `Referencia ${result.codigo} creada como borrador.`)
    } catch (error) {
      notify(`Referencia guardada, pero las imágenes no se pudieron subir: ${error.message}`, 'error')
    }
    setSaving(false)
    onSaved(result)
  }

  const err = (name) => errors[name] && <span className={styles.fieldError}>{errors[name]}</span>
  const known = ['nombre', 'ajuste', 'descripcion', 'variantes']
  const unknownErrors = Object.keys(errors).filter((key) => !known.includes(key))

  return (
    <Modal title={editing ? `Editar ${reference.codigo}` : 'Nueva referencia'} onClose={onClose} wide>
      <form className={styles.form} onSubmit={submit}>
        <div className={styles.grid}>
          <label className={`${styles.field} ${styles.full}`}>
            Nombre del diseño
            <input value={form.nombre} onChange={set('nombre')} maxLength={150} required placeholder="Ej. Skinny 5 bolsillos tiro medio" />
            {err('nombre')}
          </label>

          <label className={styles.field}>
            Tipo de ajuste
            <select value={form.ajuste} onChange={set('ajuste')} required>
              <option value="">Selecciona el ajuste</option>
              {meta.ajustes.map((fit) => (
                <option key={fit.value} value={fit.value}>{fit.label}</option>
              ))}
            </select>
            {err('ajuste')}
          </label>

          <label className={styles.field}>
            Descripción (opcional)
            <input value={form.descripcion} onChange={set('descripcion')} maxLength={500} placeholder="Tiro, tela, detalles del diseño" />
            {err('descripcion')}
          </label>

          <div className={`${styles.field} ${styles.full}`}>
            Tallas y colores
            <div className={refStyles.combos}>
              <label>
                Tallas
                <input
                  value={sizesText} onChange={(event) => setSizesText(event.target.value)}
                  placeholder="Ej. 28, 30, 32, M" aria-label="Tallas separadas por coma"
                />
              </label>
              <label>
                Colores
                <input
                  value={colorsText} onChange={(event) => setColorsText(event.target.value)}
                  placeholder="Ej. Azul oscuro, Negro" aria-label="Colores separados por coma"
                />
              </label>
              <button type="button" className={styles.secondaryBtn} onClick={addCombos}>Agregar</button>
            </div>
            <span className={styles.hint}>
              Se crea una combinación por cada talla y color escritos. Separa con comas.
              {comboNote && <strong> {comboNote}</strong>}
            </span>
            {variants.length > 0 ? (
              <ul className={refStyles.variantList} aria-label="Combinaciones de talla y color">
                {variants.map((variant) => (
                  <li key={`${variant.talla}|${variant.color}`} className={refStyles.variant}>
                    {variant.talla} · {variant.color}
                    <button
                      type="button" aria-label={`Quitar talla ${variant.talla} color ${variant.color}`}
                      onClick={() => setVariants((current) => removeVariant(current, variant))}
                    >
                      ×
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <span className={styles.hint}>Todavía no hay combinaciones. Una referencia necesita al menos una para activarse.</span>
            )}
            {err('variantes')}
          </div>

          <div className={`${styles.field} ${styles.full}`}>
            Imágenes del prototipo ({stored.length + queued.length} de {meta.max_imagenes})
            <div className={refStyles.imageGrid}>
              {stored.map((image) => (
                <div key={image.id} className={refStyles.imageTile}>
                  <div className={`${refStyles.frame} ${image.principal ? refStyles.frameMain : ''}`}>
                    <AuthImage
                      path={imagePath(image)} version={image.version} alt="Prototipo"
                      placeholder={() => <span className={styles.muted}>Cargando…</span>}
                    />
                  </div>
                  {image.principal && <span className={refStyles.mainTag}>Principal</span>}
                  <div className={refStyles.tileActions}>
                    {!image.principal && (
                      <button type="button" className={styles.linkBtn} disabled={busyImage} onClick={() => changeStored(image, 'main')}>
                        Hacer principal
                      </button>
                    )}
                    <button type="button" className={`${styles.linkBtn} ${styles.dangerText}`} disabled={busyImage} onClick={() => changeStored(image, 'remove')}>
                      Quitar
                    </button>
                  </div>
                </div>
              ))}
              {queued.map((item, index) => (
                <div key={item.key} className={refStyles.imageTile}>
                  <div className={refStyles.frame}><img src={item.preview} alt={`Vista previa ${index + 1}`} /></div>
                  {!stored.length && index === 0 && <span className={refStyles.mainTag}>Principal</span>}
                  <div className={refStyles.tileActions}>
                    <span className={styles.hint}>Sin guardar</span>
                    <button type="button" className={`${styles.linkBtn} ${styles.dangerText}`} onClick={() => dropQueued(item.key)}>
                      Quitar
                    </button>
                  </div>
                </div>
              ))}
              {room > 0 && (
                <label className={refStyles.dropHint}>
                  + Agregar imágenes
                  <input type="file" accept="image/jpeg,image/png,image/webp" multiple onChange={pickImages} hidden />
                </label>
              )}
            </div>
            <span className={styles.hint}>
              JPG, PNG o WEBP. Se reducen solas antes de subirlas. La primera es la principal; después puedes cambiarla.
            </span>
            {imageError && <span className={styles.fieldError}>{imageError}</span>}
          </div>
        </div>

        {unknownErrors.map((key) => (
          <p key={key} className={styles.formError}>{errors[key]}</p>
        ))}
        <div className={styles.actions}>
          <button type="button" className={styles.secondaryBtn} onClick={onClose}>
            {editing ? 'Cerrar' : 'Cancelar'}
          </button>
          <button type="submit" className={styles.primaryBtn} disabled={saving}>
            {saving ? 'Guardando…' : editing ? 'Guardar cambios' : 'Crear referencia'}
          </button>
        </div>
      </form>
    </Modal>
  )
}
