import { useCallback, useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { apiGet } from '../../api/client'
import { useAuth } from '../../auth/session'
import EntryForm from './EntryForm'
import HistoryTab from './HistoryTab'
import StockTab from './StockTab'
import styles from './Inventory.module.css'

/**
 * Movimientos de inventario (HU 2.3 / HU 5.3 TE-171): pestañas Existencias, Ingreso (con `inventario.gestionar`)
 * e Historial. El envío a lavandería se realiza en Producción → Lavandería (`/lavanderia/remisiones`).
 */
export default function InventoryPage() {
  const { can } = useAuth()
  const [searchParams] = useSearchParams()
  const canManage = can('inventario.gestionar')
  const [tab, setTab] = useState(() =>
    searchParams.get('tab') === 'historial' || searchParams.get('orden_compra') ? 'historial' : 'existencias',
  )
  const [products, setProducts] = useState([])
  const [loadError, setLoadError] = useState('')
  const [refreshKey, setRefreshKey] = useState(0)

  const reload = useCallback(() => {
    apiGet('/api/inventario/productos/')
      .then((data) => (setProducts(data), setLoadError('')))
      .catch((error) => setLoadError(error.message))
    setRefreshKey((key) => key + 1)
  }, [])
  useEffect(reload, [reload])

  const tabs = [
    { id: 'existencias', label: 'Existencias' },
    ...(canManage ? [{ id: 'ingreso', label: 'Ingreso' }] : []),
    { id: 'historial', label: 'Historial' },
  ]

  return (
    <div className={styles.page}>
      <header className={styles.pageHeader}>
        <p className={styles.eyebrow}>Inventario</p>
        <h1>Movimientos de almacén</h1>
        <p className={styles.subtitle}>
          Existencias, ingresos de almacén y trazabilidad histórica de órdenes y kardex.
        </p>
      </header>

      <div className={styles.tabs} role="tablist">
        {tabs.map(({ id, label }) => (
          <button
            key={id} type="button" role="tab" aria-selected={tab === id}
            className={`${styles.tab} ${tab === id ? styles.tabActive : ''}`}
            onClick={() => setTab(id)}
          >
            {label}
          </button>
        ))}
      </div>

      {loadError && <p className={styles.formError}>{loadError}</p>}

      {tab === 'existencias' && <StockTab products={products} canManage={canManage} />}
      {tab === 'ingreso' && canManage && <EntryForm products={products} onChanged={reload} />}
      {tab === 'historial' && (
        <HistoryTab products={products} canManage={canManage} refreshKey={refreshKey} onChanged={reload} />
      )}
    </div>
  )
}
