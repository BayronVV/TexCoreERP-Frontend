import { useCallback, useEffect, useState } from 'react'
import { apiGet, apiRequest } from '../../api/client'
import { useAuth } from '../../auth/session'
import { useToast } from '../ui/toastContext'
import SupplierForm from './SupplierForm'
import { fieldErrors } from './labels'
import { useInventoryMeta } from './meta'
import styles from './Inventory.module.css'
import catalogStyles from './Catalog.module.css'

function SupplierCard({ supplier, canManage, onEdit, onRemove, onRestore }) {
  return (
    <article className={`${catalogStyles.card} ${supplier.archivado ? catalogStyles.cardArchived : ''}`}>
      <div className={catalogStyles.cardBody}>
        <div className={catalogStyles.supplierTop}>
          <span className={catalogStyles.nit}>NIT: {supplier.nit_formateado}</span>
          <span className={`${styles.badge} ${supplier.archivado ? styles.badgeOff : styles.badgeOk}`}>
            {supplier.archivado ? 'ARCHIVADO' : 'ACTIVO'}
          </span>
        </div>
        <h3 className={catalogStyles.supplierName}>{supplier.razon_social}</h3>
        <p className={catalogStyles.supplierCategory}>{supplier.categoria_nombre}</p>
        <ul className={catalogStyles.contactList}>
          {supplier.contacto && <li>Contacto: <strong>{supplier.contacto}</strong></li>}
          {supplier.telefono && <li>{supplier.telefono}</li>}
          {supplier.correo && <li>{supplier.correo}</li>}
          {(supplier.ciudad || supplier.direccion) && (
            <li className={styles.muted}>{[supplier.ciudad, supplier.direccion].filter(Boolean).join(' · ')}</li>
          )}
        </ul>
      </div>
      <div className={catalogStyles.cardFooter}>
        <span className={styles.muted}>
          {supplier.insumos_vinculados} {supplier.insumos_vinculados === 1 ? 'insumo vinculado' : 'insumos vinculados'}
        </span>
        {canManage && (
          <span className={catalogStyles.cardActions}>
            {supplier.archivado ? (
              <button type="button" className={styles.linkBtn} onClick={() => onRestore(supplier)}>Restaurar</button>
            ) : (
              <>
                <button type="button" className={styles.linkBtn} onClick={() => onEdit(supplier)}>Editar</button>
                <button type="button" className={`${styles.linkBtn} ${styles.dangerText}`} onClick={() => onRemove(supplier)}>
                  Archivar
                </button>
              </>
            )}
          </span>
        )}
      </div>
    </article>
  )
}

export default function SuppliersPage() {
  const { can } = useAuth()
  const notify = useToast()
  const canManage = can('inventario.gestionar')
  const { meta, error: metaError } = useInventoryMeta()
  const [suppliers, setSuppliers] = useState(null)
  const [loadError, setLoadError] = useState('')
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('')
  const [archived, setArchived] = useState(false)
  const [editing, setEditing] = useState(null) // null | 'new' | proveedor

  const load = useCallback(() => {
    const params = new URLSearchParams()
    if (category) params.set('categoria', category)
    if (search.trim()) params.set('q', search.trim())
    if (archived) params.set('archivados', '1')
    apiGet(`/api/inventario/proveedores/?${params}`)
      .then((data) => (setSuppliers(data), setLoadError('')))
      .catch((error) => setLoadError(error.message))
  }, [category, search, archived])

  useEffect(() => {
    const timer = setTimeout(load, 250)
    return () => clearTimeout(timer)
  }, [load])

  const supplierCategories = meta?.categorias.filter((c) => c.compra) ?? []

  const remove = async (supplier) => {
    if (!window.confirm(`¿Archivar a ${supplier.razon_social}? Deja de aparecer en los ingresos, pero su historial se conserva y se puede restaurar.`)) return
    try {
      await apiRequest(`/api/inventario/proveedores/${supplier.id}/`, { method: 'DELETE' })
      notify('Proveedor archivado.')
      load()
    } catch (error) {
      notify(fieldErrors(error).detail ?? error.message, 'error')
    }
  }

  const restore = async (supplier) => {
    try {
      await apiRequest(`/api/inventario/proveedores/${supplier.id}/restaurar/`, { method: 'POST' })
      notify('Proveedor restaurado.')
      load()
    } catch (error) {
      notify(fieldErrors(error).nit ?? fieldErrors(error).detail ?? error.message, 'error')
    }
  }

  if (metaError) return <div className={styles.page}><p className={styles.formError}>{metaError}</p></div>

  return (
    <div className={styles.page}>
      <header className={`${styles.pageHeader} ${catalogStyles.headerRow}`}>
        <div>
          <p className={styles.eyebrow}>Inventario</p>
          <h1>Directorio de proveedores</h1>
          <p className={styles.subtitle}>
            Registro con NIT único y clasificación por tipo de insumo. Los ingresos de compra se hacen a un proveedor de esta lista.
          </p>
        </div>
        {canManage && meta && (
          <button type="button" className={styles.primaryBtn} onClick={() => setEditing('new')}>
            + Registrar proveedor
          </button>
        )}
      </header>

      <section className={styles.card}>
        <div className={styles.filters}>
          <input
            type="search" placeholder="Buscar por NIT, razón social, contacto o ciudad" value={search}
            onChange={(event) => setSearch(event.target.value)} aria-label="Buscar proveedores"
          />
          <select value={category} onChange={(event) => setCategory(event.target.value)} aria-label="Filtrar por tipo de insumo">
            <option value="">Todos los insumos</option>
            {supplierCategories.map((c) => (
              <option key={c.codigo} value={c.codigo}>{c.nombre}</option>
            ))}
          </select>
          <label className={catalogStyles.check}>
            <input type="checkbox" checked={archived} onChange={(event) => setArchived(event.target.checked)} />
            Ver archivados
          </label>
        </div>
        {loadError && <p className={styles.formError}>{loadError}</p>}
        {suppliers && suppliers.length === 0 && (
          <p className={styles.empty}>
            {search || category || archived
              ? 'Ningún proveedor coincide con el filtro.'
              : 'Todavía no hay proveedores. Registra el primero.'}
          </p>
        )}
      </section>

      <div className={catalogStyles.grid}>
        {(suppliers ?? []).map((supplier) => (
          <SupplierCard
            key={supplier.id} supplier={supplier} canManage={canManage}
            onEdit={setEditing} onRemove={remove} onRestore={restore}
          />
        ))}
      </div>

      {editing && meta && (
        <SupplierForm
          supplier={editing === 'new' ? null : editing} categories={supplierCategories}
          onClose={() => setEditing(null)} onSaved={() => { setEditing(null); load() }}
        />
      )}
    </div>
  )
}
