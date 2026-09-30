import { useEffect, useRef, useState } from 'react'
import { apiRequest } from '../../api/client'
import { useToast } from '../ui/toastContext'
import Modal from '../ui/Modal'
import AuthImage from './AuthImage'
import { shrinkImage } from './imageTools'
import { categoryOf, unitName } from './meta'
import { fieldErrors } from './labels'
import styles from './Inventory.module.css'
import catalogStyles from './Catalog.module.css'

const FIELD_ORDER = ['categoria', 'nombre', 'unidad', 'ancho_util', 'composicion', 'color', 'stock_minimo']

// Alta y edición de un producto del catálogo. Aquí no hay existencias: el saldo solo cambia con
// ingresos y salidas de inventario.
export default function ProductForm({ product, meta, onSaved, onClose }) {
  const notify = useToast()
  const editing = Boolean(product)
  const [form, setForm] = useState({
    categoria: product?.categoria ?? '',
    nombre: product?.nombre ?? '',
    unidad: product?.unidad ?? '',
    ancho_util: product?.ancho_util ?? '',
    composicion: product?.composicion ?? '',
    color: product?.color ?? '',
    stock_minimo: product?.stock_minimo ?? '0',
    descripcion: product?.descripcion ?? '',
  })
  const [image, setImage] = useState({ blob: null, preview: '', remove: false })
  const [imageError, setImageError] = useState('')
  const [errors, setErrors] = useState({})
  const [saving, setSaving] = useState(false)
  const previewRef = useRef('')

  useEffect(() => () => previewRef.current && URL.revokeObjectURL(previewRef.current), [])

  const category = categoryOf(meta, form.categoria)
  const set = (field) => (event) => setForm((current) => ({ ...current, [field]: event.target.value }))

  const pickCategory = (event) => {
    const next = categoryOf(meta, event.target.value)
    setForm((current) => ({
      ...current,
      categoria: event.target.value,
      // La unidad debe ser compatible con la categoría: se deja la primera si la actual no sirve.
      unidad: next?.unidades.includes(current.unidad) ? current.unidad : (next?.unidades[0] ?? ''),
    }))
  }

  const pickImage = async (event) => {
    const file = event.target.files[0]
    event.target.value = ''
    if (!file) return
    setImageError('')
    try {
      const blob = await shrinkImage(file)
      if (previewRef.current) URL.revokeObjectURL(previewRef.current)
      previewRef.current = URL.createObjectURL(blob)
      setImage({ blob, preview: previewRef.current, remove: false })
    } catch (error) {
      setImageError(error.message)
    }
  }

  const removeImage = () => {
    if (previewRef.current) URL.revokeObjectURL(previewRef.current)
    previewRef.current = ''
    setImage({ blob: null, preview: '', remove: true })
  }

  const submit = async (event) => {
    event.preventDefault()
    setSaving(true)
    setErrors({})
    const body = {
      nombre: form.nombre,
      categoria: form.categoria,
      unidad: form.unidad,
      stock_minimo: form.stock_minimo === '' ? '0' : form.stock_minimo,
      descripcion: form.descripcion,
      ancho_util: category?.requiere_ancho_util && form.ancho_util !== '' ? form.ancho_util : null,
      color: form.color,
      composicion: category?.requiere_composicion || form.composicion ? form.composicion : '',
    }
    let saved
    try {
      saved = await apiRequest(editing ? `/api/inventario/catalogo/${product.id}/` : '/api/inventario/catalogo/', {
        method: editing ? 'PATCH' : 'POST',
        body,
      })
    } catch (error) {
      setErrors(fieldErrors(error))
      setSaving(false)
      return
    }
    // El producto ya quedó guardado; si la imagen falla se avisa sin repetir el guardado.
    try {
      const url = `/api/inventario/catalogo/${saved.id}/imagen/`
      if (image.blob) {
        const data = new FormData()
        data.append('imagen', image.blob, 'referencia.jpg')
        saved = await apiRequest(url, { method: 'POST', body: data })
      } else if (image.remove && saved.tiene_imagen) {
        saved = await apiRequest(url, { method: 'DELETE' })
      }
      notify(editing ? 'Producto actualizado.' : `Producto ${saved.codigo} creado.`)
    } catch (error) {
      notify(`Producto guardado, pero la imagen no se pudo actualizar: ${error.message}`, 'error')
    }
    setSaving(false)
    onSaved(saved)
  }

  const err = (name) => errors[name] && <span className={styles.fieldError}>{errors[name]}</span>
  const showCurrent = editing && product.tiene_imagen && !image.remove && !image.blob
  const unknownErrors = Object.keys(errors).filter((key) => !FIELD_ORDER.includes(key) && key !== 'descripcion')

  return (
    <Modal title={editing ? `Editar ${product.codigo}` : 'Nuevo producto'} onClose={onClose} wide>
      <form className={styles.form} onSubmit={submit}>
        <div className={styles.grid}>
          <label className={styles.field}>
            Categoría
            <select value={form.categoria} onChange={pickCategory} required disabled={editing && Boolean(product.categoria)}>
              <option value="">Selecciona la categoría</option>
              <optgroup label="Telas e insumos">
                {meta.categorias.filter((c) => c.compra).map((c) => (
                  <option key={c.codigo} value={c.codigo}>{c.nombre}</option>
                ))}
              </optgroup>
              <optgroup label="Pantalones">
                {meta.categorias.filter((c) => !c.compra).map((c) => (
                  <option key={c.codigo} value={c.codigo}>{c.nombre}</option>
                ))}
              </optgroup>
            </select>
            {editing && product.categoria && (
              <span className={styles.hint}>La categoría y la unidad no se cambian; si te equivocaste, elimina el producto y créalo de nuevo.</span>
            )}
            {err('categoria')}
          </label>

          <label className={styles.field}>
            Unidad de medida
            <select value={form.unidad} onChange={set('unidad')} required disabled={!category || (editing && Boolean(product.categoria))}>
              <option value="">{category ? 'Selecciona' : 'Primero elige la categoría'}</option>
              {category?.unidades.map((code) => (
                <option key={code} value={code}>{unitName(meta, code)}</option>
              ))}
            </select>
            {err('unidad')}
          </label>

          <label className={`${styles.field} ${styles.full}`}>
            Nombre
            <input value={form.nombre} onChange={set('nombre')} maxLength={150} required placeholder="Ej. Denim rígido 14 oz índigo intenso" />
            {err('nombre')}
          </label>

          {category?.requiere_ancho_util && (
            <label className={styles.field}>
              Ancho útil (m)
              <input
                type="number" step="0.01" min="0.01" max={meta.ancho_util_max} value={form.ancho_util}
                onChange={set('ancho_util')} required placeholder="Ej. 1.60"
              />
              <span className={styles.hint}>Ancho del rollo: lo usa el corte computarizado.</span>
              {err('ancho_util')}
            </label>
          )}

          {category && (
            <label className={styles.field}>
              Color / tono {category.requiere_ancho_util ? '' : '(opcional)'}
              <input value={form.color} onChange={set('color')} maxLength={60} placeholder="Ej. Azul índigo" />
              {err('color')}
            </label>
          )}

          {(category?.requiere_composicion || form.composicion) && (
            <label className={`${styles.field} ${styles.full}`}>
              Composición textil
              <input
                value={form.composicion} onChange={set('composicion')} maxLength={120}
                required={category?.requiere_composicion} placeholder="Ej. 98% algodón / 2% elastano"
              />
              <span className={styles.hint}>Con porcentajes que sumen 100 (ej. 100% algodón, o 80% algodón y 20% nylon).</span>
              {err('composicion')}
            </label>
          )}

          <label className={styles.field}>
            Stock mínimo {category ? `(${unitName(meta, form.unidad || category.unidades[0])})` : ''}
            <input type="number" min="0" step="0.01" value={form.stock_minimo} onChange={set('stock_minimo')} />
            <span className={styles.hint}>Al llegar a esta cantidad aparece la alerta. Con 0 no hay alertas.</span>
            {err('stock_minimo')}
          </label>

          <label className={styles.field}>
            Descripción (opcional)
            <input value={form.descripcion} onChange={set('descripcion')} maxLength={255} />
            {err('descripcion')}
          </label>

          <div className={`${styles.field} ${styles.full}`}>
            Imagen de referencia (opcional)
            <div className={catalogStyles.imagePicker}>
              <div className={catalogStyles.imagePreview}>
                {image.preview && <img src={image.preview} alt="Vista previa" />}
                {showCurrent && (
                  <AuthImage
                    productId={product.id} version={product.imagen_version} alt={product.nombre}
                    placeholder={() => <span className={styles.muted}>Cargando…</span>}
                  />
                )}
                {!image.preview && !showCurrent && <span className={styles.muted}>Sin imagen</span>}
              </div>
              <div className={catalogStyles.imageActions}>
                <label className={styles.secondaryBtn}>
                  {image.preview || showCurrent ? 'Cambiar imagen' : 'Elegir imagen'}
                  <input type="file" accept="image/jpeg,image/png,image/webp" onChange={pickImage} hidden />
                </label>
                {(image.preview || showCurrent) && (
                  <button type="button" className={`${styles.linkBtn} ${styles.dangerText}`} onClick={removeImage}>
                    Quitar imagen
                  </button>
                )}
                <span className={styles.hint}>JPG, PNG o WEBP. Se reduce sola antes de subirla.</span>
                {imageError && <span className={styles.fieldError}>{imageError}</span>}
              </div>
            </div>
          </div>
        </div>

        {unknownErrors.map((key) => (
          <p key={key} className={styles.formError}>{errors[key]}</p>
        ))}
        <div className={styles.actions}>
          <button type="button" className={styles.secondaryBtn} onClick={onClose}>Cancelar</button>
          <button type="submit" className={styles.primaryBtn} disabled={saving}>
            {saving ? 'Guardando…' : editing ? 'Guardar cambios' : 'Crear producto'}
          </button>
        </div>
      </form>
    </Modal>
  )
}
