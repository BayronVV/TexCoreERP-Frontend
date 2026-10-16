import { useCallback, useEffect, useState } from 'react'
import { apiGet, apiRequest } from '../../api/client'
import { useAuth } from '../../auth/session'
import { useToast } from '../ui/toastContext'
import AuthImage from '../Inventory/AuthImage'
import { fieldErrors } from '../Inventory/labels'
import styles from '../Inventory/Inventory.module.css'
import catalogStyles from '../Inventory/Catalog.module.css'
import refStyles from './References.module.css'
import ReferenceForm from './ReferenceForm'

const STATE_BADGE = { BORRADOR: styles.badgeWarn, ACTIVA: styles.badgeOk, DESCONTINUADA: styles.badgeOff }

const Placeholder = ({ name }) => (
  <div className={catalogStyles.thumbEmpty} aria-hidden="true">
    <span>{name.trim().charAt(0).toUpperCase()}</span>
  </div>
)

function ReferenceCard({ reference, canManage, onEdit, onState, onArchive }) {
  const main = reference.imagen_principal
  return (
    <article className={`${catalogStyles.card} ${reference.estado === 'DESCONTINUADA' ? catalogStyles.cardArchived : ''}`}>
      <div className={`${catalogStyles.thumb} ${refStyles.thumbBox}`}>
        {main ? (
          <AuthImage
            path={`/api/referencias/imagenes/${main.id}/archivo/`} version={main.version} alt={reference.nombre}
            className={catalogStyles.thumbImg} placeholder={() => <Placeholder name={reference.nombre} />}
          />
        ) : (
          <Placeholder name={reference.nombre} />
        )}
        {reference.imagenes.length > 1 && <span className={refStyles.imageCount}>{reference.imagenes.length} fotos</span>}
      </div>
      <div className={catalogStyles.cardBody}>
        <div className={catalogStyles.cardTitle}>
          <h3>{reference.nombre}</h3>
          <span className={catalogStyles.code}>{reference.codigo}</span>
        </div>
        <div className={catalogStyles.chips}>
          <span className={`${styles.badge} ${STATE_BADGE[reference.estado]}`}>{reference.estado_nombre}</span>
          <span className={`${styles.badge} ${styles.badgeInfo}`}>{reference.ajuste_nombre}</span>
        </div>
        {reference.descripcion && <p className={styles.muted}>{reference.descripcion}</p>}
        <dl className={refStyles.facts}>
          <dt>Tallas</dt>
          <dd>{reference.tallas.length ? reference.tallas.join(', ') : 'Sin definir'}</dd>
          <dt>Colores</dt>
          <dd>{reference.colores.length ? reference.colores.join(', ') : 'Sin definir'}</dd>
        </dl>
      </div>
      {canManage && (
        <div className={catalogStyles.cardActions}>
          <button type="button" className={styles.linkBtn} onClick={() => onEdit(reference)}>Editar</button>
          {reference.estado !== 'ACTIVA' && (
            <button type="button" className={styles.linkBtn} onClick={() => onState(reference, 'ACTIVA')}>
              {reference.estado === 'BORRADOR' ? 'Activar' : 'Reactivar'}
            </button>
          )}
          {reference.estado === 'ACTIVA' && (
            <button type="button" className={styles.linkBtn} onClick={() => onState(reference, 'DESCONTINUADA')}>
              Descontinuar
            </button>
          )}
          {reference.estado !== 'ACTIVA' && (
            <button type="button" className={`${styles.linkBtn} ${styles.dangerText}`} onClick={() => onArchive(reference)}>
              Archivar
            </button>
          )}
        </div>
      )}
    </article>
  )
}

// Catálogo de referencias de jean (HU 3.1): los modelos que fabrica la empresa, con sus tallas, colores y fotos.
export default function ReferencesPage() {
  const { can } = useAuth()
  const notify = useToast()
  const canManage = can('referencias.gestionar')
  const [meta, setMeta] = useState(null)
  const [metaError, setMetaError] = useState('')
  const [references, setReferences] = useState(null)
  const [loadError, setLoadError] = useState('')
  const [filters, setFilters] = useState({ q: '', estado: '', ajuste: '', talla: '', color: '' })
  const [editing, setEditing] = useState(null) // null | 'new' | referencia

  useEffect(() => {
    apiGet('/api/referencias/metadatos/').then(setMeta).catch((error) => setMetaError(error.message))
  }, [])

  const load = useCallback(() => {
    const params = new URLSearchParams()
    for (const [key, value] of Object.entries(filters)) if (value.trim()) params.set(key, value.trim())
    apiGet(`/api/referencias/?${params}`)
      .then((data) => (setReferences(data), setLoadError('')))
      .catch((error) => setLoadError(error.message))
  }, [filters])

  // Los filtros de texto esperan a que la persona deje de escribir.
  useEffect(() => {
    const timer = setTimeout(load, 250)
    return () => clearTimeout(timer)
  }, [load])

  const setFilter = (field) => (event) => setFilters((current) => ({ ...current, [field]: event.target.value }))

  const changeState = async (reference, estado) => {
    if (estado === 'DESCONTINUADA' && !window.confirm(`¿Descontinuar ${reference.nombre}? Sigue en el catálogo, pero deja de estar activa.`)) return
    try {
      await apiRequest(`/api/referencias/${reference.id}/estado/`, { method: 'POST', body: { estado } })
      notify(estado === 'ACTIVA' ? `${reference.codigo} activada.` : `${reference.codigo} descontinuada.`)
      load()
    } catch (error) {
      notify(fieldErrors(error).estado ?? error.message, 'error')
    }
  }

  const archive = async (reference) => {
    if (!window.confirm(`¿Archivar ${reference.nombre}? Deja de aparecer en el catálogo.`)) return
    try {
      await apiRequest(`/api/referencias/${reference.id}/`, { method: 'DELETE' })
      notify('Referencia archivada.')
      load()
    } catch (error) {
      notify(fieldErrors(error).estado ?? error.message, 'error')
    }
  }

  if (metaError) return <div className={styles.page}><p className={styles.formError}>{metaError}</p></div>

  const filtered = Object.values(filters).some((value) => value.trim())

  return (
    <div className={styles.page}>
      <header className={`${styles.pageHeader} ${catalogStyles.headerRow}`}>
        <div>
          <p className={styles.eyebrow}>Producción</p>
          <h1>Referencias de jean</h1>
          <p className={styles.subtitle}>
            Los modelos que fabrica la empresa: diseño, ajuste, tallas, colores y fotos del prototipo.
          </p>
        </div>
        {canManage && meta && (
          <button type="button" className={styles.primaryBtn} onClick={() => setEditing('new')}>
            + Nueva referencia
          </button>
        )}
      </header>

      <section className={styles.card}>
        <div className={styles.filters}>
          <input
            type="search" placeholder="Buscar por nombre, código o color" value={filters.q}
            onChange={setFilter('q')} aria-label="Buscar referencias"
          />
          <select value={filters.estado} onChange={setFilter('estado')} aria-label="Filtrar por estado">
            <option value="">Todos los estados</option>
            {meta?.estados.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
          <select value={filters.ajuste} onChange={setFilter('ajuste')} aria-label="Filtrar por ajuste">
            <option value="">Todos los ajustes</option>
            {meta?.ajustes.map((a) => <option key={a.value} value={a.value}>{a.label}</option>)}
          </select>
          <input value={filters.talla} onChange={setFilter('talla')} placeholder="Talla" aria-label="Filtrar por talla" size={6} />
          <input value={filters.color} onChange={setFilter('color')} placeholder="Color" aria-label="Filtrar por color" size={10} />
        </div>
        {loadError && <p className={styles.formError}>{loadError}</p>}
        {references && references.length === 0 && (
          <p className={styles.empty}>
            {filtered ? 'Ninguna referencia coincide con los filtros.' : 'Todavía no hay referencias. Registra la primera.'}
          </p>
        )}
      </section>

      <div className={catalogStyles.grid}>
        {references?.map((reference) => (
          <ReferenceCard
            key={reference.id} reference={reference} canManage={canManage}
            onEdit={setEditing} onState={changeState} onArchive={archive}
          />
        ))}
      </div>

      {editing && meta && (
        <ReferenceForm
          key={editing === 'new' ? 'new' : editing.id}
          reference={editing === 'new' ? null : editing} meta={meta}
          onClose={() => { setEditing(null); load() }} // al cerrar se recarga: las fotos se cambian sin guardar el formulario
          onSaved={() => { setEditing(null); load() }}
        />
      )}
    </div>
  )
}
