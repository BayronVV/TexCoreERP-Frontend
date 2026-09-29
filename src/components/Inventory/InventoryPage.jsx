import { useCallback, useEffect, useState } from 'react'
import { apiGet } from '../../api/client'
import { useAuth } from '../../auth/session'
import EntryForm from './EntryForm'
import ExitForm from './ExitForm'
import HistoryTab from './HistoryTab'
import StockTab from './StockTab'
import styles from './Inventory.module.css'

export default function InventoryPage() {
  const { can } = useAuth()
  const canManage = can('inventario.gestionar')
  const [tab, setTab] = useState('existencias')
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
    ...(canManage ? [{ id: 'ingreso', label: 'Ingreso' }, { id: 'salida', label: 'Salida' }] : []),
    { id: 'historial', label: 'Historial' },
  ]

  return (
    <div className={styles.page}>
      <header className={styles.pageHeader}>
        <p className={styles.eyebrow}>Inventario</p>
        <h1>Movimientos de almacén</h1>
        <p className={styles.subtitle}>
          Existencias, ingresos, salidas por orden y su trazabilidad.
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

      {tab === 'existencias' && <StockTab products={products} canManage={canManage} onChanged={reload} />}
      {tab === 'ingreso' && canManage && <EntryForm products={products} onChanged={reload} />}
      {tab === 'salida' && canManage && <ExitForm products={products} onChanged={reload} />}
      {tab === 'historial' && (
        <HistoryTab products={products} canManage={canManage} refreshKey={refreshKey} onChanged={reload} />
      )}
    </div>
  )
}
