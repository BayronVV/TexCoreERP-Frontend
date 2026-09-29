import { useMemo, useState } from 'react'
import { apiRequest } from '../../api/client'
import { useToast } from '../ui/toastContext'
import ProductModal from './ProductModal'
import { PRODUCT_TYPES, fieldErrors, formatQty, typeLabel } from './labels'
import styles from './Inventory.module.css'

function stateOf(product) {
  const stock = Number(product.stock_actual)
  if (Number(product.stock_minimo) > 0 && stock <= 0) return { label: 'Agotado', badge: styles.badgeDanger, row: styles.rowOut }
  if (product.bajo_minimo) return { label: 'Bajo el mínimo', badge: styles.badgeWarn, row: styles.rowLow }
  return { label: 'Normal', badge: styles.badgeOk, row: '' }
}

export default function StockTab({ products, canManage, onChanged }) {
  const notify = useToast()
  const [kind, setKind] = useState('')
  const [search, setSearch] = useState('')
  const [editing, setEditing] = useState(null)
  const [creating, setCreating] = useState(false)

  const alerts = products.filter((p) => p.bajo_minimo)
  const visible = useMemo(() => {
    const text = search.trim().toLowerCase()
    return products.filter(
      (p) => (!kind || p.tipo === kind) && (!text || `${p.codigo} ${p.nombre}`.toLowerCase().includes(text)),
    )
  }, [products, kind, search])

  const remove = async (product) => {
    if (!window.confirm(`¿Eliminar ${product.nombre}? Deja de aparecer, pero su historial se conserva.`)) return
    try {
      await apiRequest(`/api/inventario/productos/${product.id}/`, { method: 'DELETE' })
      notify('Producto eliminado.')
      onChanged()
    } catch (error) {
      notify(fieldErrors(error).detail ?? error.message, 'error')
    }
  }

  return (
    <>
      {alerts.length > 0 ? (
        <div className={`${styles.banner} ${styles.bannerWarn}`} role="status">
          <div>
            <strong>
              {alerts.length} {alerts.length === 1 ? 'producto llegó' : 'productos llegaron'} a su stock mínimo
            </strong>
            <div>{alerts.map((p) => p.nombre).join(', ')}.</div>
          </div>
        </div>
      ) : (
        <div className={styles.banner}>Todo en orden: ningún producto está por debajo de su mínimo.</div>
      )}

      <section className={styles.card}>
        <div className={styles.cardHead}>
          <h2 className={styles.cardTitle}>Existencias</h2>
          {canManage && (
            <button type="button" className={styles.primaryBtn} onClick={() => setCreating(true)}>
              Nuevo producto
            </button>
          )}
        </div>

        <div className={styles.filters}>
          <input type="search" placeholder="Buscar por nombre o código" value={search} onChange={(e) => setSearch(e.target.value)} />
          <select value={kind} onChange={(e) => setKind(e.target.value)} aria-label="Filtrar por tipo">
            <option value="">Todos los tipos</option>
            {PRODUCT_TYPES.map((t) => (
              <option key={t.value} value={t.value}>{t.plural}</option>
            ))}
          </select>
        </div>

        {visible.length === 0 ? (
          <p className={styles.empty}>
            {products.length === 0 ? 'Todavía no hay productos. Crea el primero con "Nuevo producto".' : 'Ningún producto coincide con el filtro.'}
          </p>
        ) : (
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Código</th>
                  <th>Producto</th>
                  <th>Tipo</th>
                  <th className={styles.num}>Existencias</th>
                  <th className={styles.num}>Mínimo</th>
                  <th>Estado</th>
                  {canManage && <th />}
                </tr>
              </thead>
              <tbody>
                {visible.map((product) => {
                  const state = stateOf(product)
                  return (
                    <tr key={product.id} className={state.row}>
                      <td>{product.codigo}</td>
                      <td>{product.nombre}</td>
                      <td>{typeLabel(product.tipo)}</td>
                      <td className={styles.num}>{formatQty(product.stock_actual, product.unidad)}</td>
                      <td className={styles.num}>
                        {Number(product.stock_minimo) > 0 ? formatQty(product.stock_minimo, product.unidad) : '—'}
                      </td>
                      <td><span className={`${styles.badge} ${state.badge}`}>{state.label}</span></td>
                      {canManage && (
                        <td className={styles.num}>
                          <button type="button" className={styles.linkBtn} onClick={() => setEditing(product)}>Editar</button>
                          <button type="button" className={`${styles.linkBtn} ${styles.dangerText}`} onClick={() => remove(product)}>
                            Eliminar
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
      </section>

      {(creating || editing) && (
        <ProductModal
          product={editing}
          onClose={() => { setCreating(false); setEditing(null) }}
          onSaved={() => { setCreating(false); setEditing(null); onChanged() }}
        />
      )}
    </>
  )
}
