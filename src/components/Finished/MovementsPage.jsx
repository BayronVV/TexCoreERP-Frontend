import { useCallback, useEffect, useState } from 'react'
import { apiGet } from '../../api/client'
import ListPager from '../ui/ListPager'
import { usePersistedFilters } from '../ui/usePersistedFilters'
import styles from '../Inventory/Inventory.module.css'
import finishedStyles from './Finished.module.css'
import { signed } from './finished'

const TYPES = [
  { value: '', label: 'Todos los tipos' },
  { value: 'ENTRADA_PRODUCCION', label: 'Entrada de producción' },
  { value: 'AJUSTE', label: 'Ajuste manual' },
  { value: 'SALIDA_VENTA', label: 'Salida por venta' },
  { value: 'DEVOLUCION_VENTA', label: 'Reingreso por anulación de venta' },
]

const FINISHED_FILTERS = {
  q: '',
  tipo: '',
  referencia: '',
  lote: '',
  cliente: '',
  vendedor: '',
  responsable: '',
  desde: '',
  hasta: '',
}

const formatMoment = (value) => new Date(value).toLocaleString('es-CO', { dateStyle: 'medium', timeStyle: 'short' })

/**
 * Producto terminado · Movimientos, ruta `/producto-terminado/movimientos` (`producto_terminado.ver`): libro del inventario final con filtros combinables, persistentes y paginación.
 */
export default function MovementsPage() {
  const [pageData, setPageData] = useState(null)
  const [references, setReferences] = useState([])
  const [clients, setClients] = useState([])
  const [sellers, setSellers] = useState([])
  const {
    filters,
    page,
    pageSize,
    activeCount,
    setFilter,
    setPage,
    setPageSize,
    clearFilters,
  } = usePersistedFilters('texcore_filters_finished_movements', FINISHED_FILTERS)
  const [loadError, setLoadError] = useState('')

  useEffect(() => {
    apiGet('/api/referencias/?limit=200').then(setReferences).catch(() => {})
    apiGet('/api/ventas/clientes/?limit=200').then(setClients).catch(() => {})
    apiGet('/api/ventas/metadatos/').then((m) => setSellers(m.vendedores ?? [])).catch(() => {})
  }, [])

  const load = useCallback(() => {
    const params = new URLSearchParams({ page: String(page), page_size: String(pageSize) })
    if (filters.q.trim()) params.set('q', filters.q.trim())
    if (filters.tipo) params.set('tipo', filters.tipo)
    if (filters.referencia) params.set('referencia', filters.referencia)
    if (filters.lote.trim()) params.set('lote', filters.lote.trim())
    if (filters.cliente) params.set('cliente', filters.cliente)
    if (filters.vendedor) params.set('vendedor', filters.vendedor)
    if (filters.responsable.trim()) params.set('responsable', filters.responsable.trim())
    if (filters.desde) params.set('desde', filters.desde)
    if (filters.hasta) params.set('hasta', filters.hasta)
    apiGet(`/api/terminado/movimientos/?${params}`).then((data) => (setPageData(data), setLoadError(''))).catch((error) => setLoadError(error.message))
  }, [filters, page, pageSize])

  useEffect(() => {
    const timer = setTimeout(load, 200)
    return () => clearTimeout(timer)
  }, [load])

  const rows = pageData?.results ?? null

  return (
    <div className={styles.page}>
      <header className={styles.pageHeader}>
        <p className={styles.eyebrow}>Producto terminado</p>
        <h1>Movimientos</h1>
        <p className={styles.subtitle}>El historial del inventario final: entradas, ajustes y salidas, con el saldo antes y después de cada uno.</p>
      </header>

      <section className={styles.card}>
        <div className={styles.filters}>
          <input type="search" placeholder="Referencia, lote, factura o nota" value={filters.q} onChange={(e) => setFilter('q', e.target.value)} aria-label="Buscar movimientos de terminado" />
          <select value={filters.tipo} onChange={(event) => setFilter('tipo', event.target.value)} aria-label="Filtrar por tipo">
            {TYPES.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select>
          <select value={filters.referencia} onChange={(e) => setFilter('referencia', e.target.value)} aria-label="Filtrar por referencia">
            <option value="">Todas las referencias</option>
            {references.map((r) => <option key={r.id} value={r.id}>{r.codigo} · {r.nombre}</option>)}
          </select>
          <select value={filters.cliente} onChange={(e) => setFilter('cliente', e.target.value)} aria-label="Filtrar por cliente">
            <option value="">Todos los clientes</option>
            {clients.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
          </select>
          <select value={filters.vendedor} onChange={(e) => setFilter('vendedor', e.target.value)} aria-label="Filtrar por vendedor">
            <option value="">Todos los vendedores</option>
            {sellers.map((s) => <option key={s.id} value={s.id}>{s.nombre}</option>)}
          </select>
          <input type="text" placeholder="Lote" value={filters.lote} onChange={(e) => setFilter('lote', e.target.value)} aria-label="Filtrar por lote" />
          <input type="text" placeholder="Responsable" value={filters.responsable} onChange={(e) => setFilter('responsable', e.target.value)} aria-label="Filtrar por responsable" />
          <label>Desde <input type="date" value={filters.desde} onChange={(event) => setFilter('desde', event.target.value)} /></label>
          <label>Hasta <input type="date" value={filters.hasta} onChange={(event) => setFilter('hasta', event.target.value)} /></label>
        </div>
        <div className={styles.filterSummary}>
          <span>{pageData ? `${pageData.count.toLocaleString('es-CO')} movimiento(s) encontrados` : 'Consultando movimientos…'}</span>
          {activeCount > 0 && (
            <button type="button" className={styles.secondaryBtn} onClick={clearFilters}>
              Limpiar filtros ({activeCount})
            </button>
          )}
        </div>
        {loadError && <p className={styles.formError}>{loadError}</p>}
        {rows && rows.length === 0 && <p className={styles.empty}>No hay movimientos con ese filtro.</p>}
        {rows && rows.length > 0 && (
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Fecha</th><th>Tipo</th><th>Referencia</th><th>Talla y color</th><th className={styles.num}>Cantidad</th>
                  <th className={styles.num}>Saldo antes</th><th className={styles.num}>Saldo después</th><th>Origen</th><th>Usuario</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id}>
                    <td>{formatMoment(row.created_at)}</td>
                    <td>{row.tipo_nombre}</td>
                    <td>{row.referencia_nombre}</td>
                    <td>{row.talla} · {row.color}</td>
                    <td className={`${styles.num} ${row.cantidad > 0 ? finishedStyles.up : finishedStyles.down}`}>{signed(row.cantidad)}</td>
                    <td className={styles.num}>{row.saldo_antes}</td>
                    <td className={styles.num}>{row.saldo_despues}</td>
                    <td>{[row.ingreso_codigo, row.ajuste_codigo, row.factura_numero, row.lote_codigo].filter(Boolean).join(' · ') || '—'}</td>
                    <td>{row.usuario_nombre || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {pageData && (
          <ListPager
            count={pageData.count}
            page={pageData.page}
            pageSize={pageData.page_size}
            totalPages={pageData.total_pages}
            onPageChange={setPage}
            onPageSizeChange={setPageSize}
            noun="movimientos"
          />
        )}
      </section>
    </div>
  )
}
