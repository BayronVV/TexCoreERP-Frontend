import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { apiGet, apiRequest } from '../../api/client'
import { useAuth } from '../../auth/session'
import { useToast } from '../ui/toastContext'
import AuthImage from './AuthImage'
import ProductForm from './ProductForm'
import { fieldErrors, formatQty } from './labels'
import { useInventoryMeta, unitName } from './meta'
import styles from './Inventory.module.css'
import catalogStyles from './Catalog.module.css'

const Placeholder = ({ name }) => (
  <div className={catalogStyles.thumbEmpty} aria-hidden="true">
    <span>{name.trim().charAt(0).toUpperCase()}</span>
  </div>
)

function ProductCard({ product, meta, canManage, onEdit, onRemove }) {
  const byMeters = ['m', 'rollo'].includes(product.unidad)
  return (
    <article className={catalogStyles.card}>
      <div className={catalogStyles.thumb}>
        {product.tiene_imagen ? (
          <AuthImage
            productId={product.id} version={product.imagen_version} alt={product.nombre}
            className={catalogStyles.thumbImg} placeholder={() => <Placeholder name={product.nombre} />}
          />
        ) : (
          <Placeholder name={product.nombre} />
        )}
      </div>
      <div className={catalogStyles.cardBody}>
        <div className={catalogStyles.cardTitle}>
          <h3>{product.nombre}</h3>
          <span className={catalogStyles.code}>{product.codigo}</span>
        </div>
        <div className={catalogStyles.chips}>
          <span className={`${styles.badge} ${styles.badgeInfo}`}>{product.tipo_nombre}</span>
          <span className={`${styles.badge} ${byMeters ? catalogStyles.unitMeters : catalogStyles.unitCount}`}>
            {unitName(meta, product.unidad)}
          </span>
        </div>
        <dl className={catalogStyles.facts}>
          {product.ancho_util && (<><dt>Ancho útil</dt><dd>{formatQty(product.ancho_util)} m</dd></>)}
          {product.color && (<><dt>Color / tono</dt><dd>{product.color}</dd></>)}
          {product.composicion && (<><dt>Composición</dt><dd>{product.composicion}</dd></>)}
          <dt>Stock mínimo</dt>
          <dd>{Number(product.stock_minimo) > 0 ? formatQty(product.stock_minimo, product.unidad) : 'Sin alerta'}</dd>
        </dl>
        {product.descripcion && <p className={styles.muted}>{product.descripcion}</p>}
      </div>
      {canManage && (
        <div className={catalogStyles.cardActions}>
          <button type="button" className={styles.linkBtn} onClick={() => onEdit(product)}>Editar</button>
          <button type="button" className={`${styles.linkBtn} ${styles.dangerText}`} onClick={() => onRemove(product)}>
            Eliminar
          </button>
        </div>
      )}
    </article>
  )
}

export default function CatalogPage() {
  const { can } = useAuth()
  const notify = useToast()
  const canManage = can('inventario.gestionar')
  const { meta, error: metaError } = useInventoryMeta()
  const [products, setProducts] = useState(null)
  const [loadError, setLoadError] = useState('')
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('')
  const [editing, setEditing] = useState(null) // null | 'new' | producto

  const load = useCallback(() => {
    const params = new URLSearchParams()
    if (category) params.set('categoria', category)
    if (search.trim()) params.set('q', search.trim())
    apiGet(`/api/inventario/catalogo/?${params}`)
      .then((data) => (setProducts(data), setLoadError('')))
      .catch((error) => setLoadError(error.message))
  }, [category, search])

  // La búsqueda espera a que la persona deje de escribir.
  useEffect(() => {
    const timer = setTimeout(load, 250)
    return () => clearTimeout(timer)
  }, [load])

  const groups = useMemo(() => {
    const byCategory = new Map()
    for (const product of products ?? []) {
      const key = product.categoria || 'SIN_CATEGORIA'
      if (!byCategory.has(key)) byCategory.set(key, { name: product.categoria_nombre, items: [] })
      byCategory.get(key).items.push(product)
    }
    // En el orden lógico de las categorías (telas primero), no en el alfabético del código.
    const order = meta?.categorias.map((c) => c.nombre) ?? []
    return [...byCategory.values()].sort((a, b) => order.indexOf(a.name) - order.indexOf(b.name))
  }, [products, meta])

  const remove = async (product) => {
    if (!window.confirm(`¿Eliminar ${product.nombre}? Deja de aparecer en el catálogo, pero su historial se conserva.`)) return
    try {
      await apiRequest(`/api/inventario/catalogo/${product.id}/`, { method: 'DELETE' })
      notify('Producto eliminado.')
      load()
    } catch (error) {
      notify(fieldErrors(error).detail ?? error.message, 'error')
    }
  }

  if (metaError) return <div className={styles.page}><p className={styles.formError}>{metaError}</p></div>

  return (
    <div className={styles.page}>
      <header className={`${styles.pageHeader} ${catalogStyles.headerRow}`}>
        <div>
          <p className={styles.eyebrow}>Inventario</p>
          <h1>Catálogo de telas e insumos</h1>
          <p className={styles.subtitle}>
            Aquí se definen los productos. Las existencias se consultan y se mueven desde{' '}
            <Link to="/inventario" className={styles.textLink}>Movimientos de almacén</Link>.
          </p>
        </div>
        {canManage && meta && (
          <button type="button" className={styles.primaryBtn} onClick={() => setEditing('new')}>
            + Nuevo producto
          </button>
        )}
      </header>

      <section className={styles.card}>
        <div className={styles.filters}>
          <input
            type="search" placeholder="Buscar por nombre, código o color" value={search}
            onChange={(event) => setSearch(event.target.value)} aria-label="Buscar en el catálogo"
          />
          <select value={category} onChange={(event) => setCategory(event.target.value)} aria-label="Filtrar por categoría">
            <option value="">Todas las categorías</option>
            {meta?.categorias.map((c) => (
              <option key={c.codigo} value={c.codigo}>{c.nombre}</option>
            ))}
          </select>
        </div>
        {loadError && <p className={styles.formError}>{loadError}</p>}
        {products && products.length === 0 && (
          <p className={styles.empty}>
            {search || category ? 'Ningún producto coincide con la búsqueda.' : 'El catálogo está vacío. Crea el primer producto.'}
          </p>
        )}
      </section>

      {groups.map((group) => (
        <section key={group.name} className={catalogStyles.group}>
          <h2 className={catalogStyles.groupTitle}>
            {group.name} <span className={catalogStyles.groupCount}>{group.items.length}</span>
          </h2>
          <div className={catalogStyles.grid}>
            {group.items.map((product) => (
              <ProductCard
                key={product.id} product={product} meta={meta} canManage={canManage}
                onEdit={setEditing} onRemove={remove}
              />
            ))}
          </div>
        </section>
      ))}

      {editing && meta && (
        <ProductForm
          product={editing === 'new' ? null : editing} meta={meta}
          onClose={() => setEditing(null)} onSaved={() => { setEditing(null); load() }}
        />
      )}
    </div>
  )
}
