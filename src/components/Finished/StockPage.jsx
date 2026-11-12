import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { apiGet } from '../../api/client'
import { useAuth } from '../../auth/session'
import styles from '../Inventory/Inventory.module.css'
import finishedStyles from './Finished.module.css'

/**
 * Producto terminado · Existencias, ruta `/producto-terminado/existencias` (`producto_terminado.ver`): la matriz referencia × color × talla de las
 * prendas de primera calidad; las celdas en cero se resaltan y el saldo lo calcula el servidor. Con `producto_terminado.ajustar` enlaza a «Ajustar».
 * Lee `GET /api/terminado/existencias/`.
 */
export default function StockPage() {
  const { can } = useAuth()
  const [matrix, setMatrix] = useState(null)
  const [reference, setReference] = useState('')
  const [search, setSearch] = useState('')
  const [loadError, setLoadError] = useState('')

  const load = useCallback(() => {
    const params = new URLSearchParams()
    if (reference) params.set('referencia', reference)
    apiGet(`/api/terminado/existencias/?${params}`).then((data) => (setMatrix(data), setLoadError(''))).catch((error) => setLoadError(error.message))
  }, [reference])

  useEffect(() => {
    load()
  }, [load])

  const text = search.trim().toLowerCase()
  const visible = (matrix ?? []).filter((item) => !text || `${item.codigo} ${item.nombre}`.toLowerCase().includes(text))
  const grand = (matrix ?? []).reduce((sum, item) => sum + item.total, 0)

  return (
    <div className={styles.page}>
      <header className={styles.pageHeader}>
        <p className={styles.eyebrow}>Producto terminado</p>
        <h1>Existencias</h1>
        <p className={styles.subtitle}>
          Prendas de primera calidad disponibles por referencia, color y talla. Las celdas en cero aparecen resaltadas.
          {matrix && <> Total en inventario: <strong>{grand}</strong> prendas.</>}
        </p>
      </header>

      <section className={styles.card}>
        <div className={styles.filters}>
          <input type="search" placeholder="Buscar referencia" value={search} onChange={(event) => setSearch(event.target.value)} aria-label="Buscar referencia" />
          <select value={reference} onChange={(event) => setReference(event.target.value)} aria-label="Filtrar por referencia">
            <option value="">Todas las referencias</option>
            {(matrix ?? []).map((item) => <option key={item.referencia} value={item.referencia}>{item.codigo} · {item.nombre}</option>)}
          </select>
          <button type="button" className={styles.secondaryBtn} onClick={load}>Actualizar</button>
        </div>
        {loadError && <p className={styles.formError}>{loadError}</p>}
        {matrix && visible.length === 0 && <p className={styles.empty}>No hay referencias con existencias para mostrar.</p>}
        {visible.map((item) => (
          <div key={item.referencia} className={finishedStyles.refBlock}>
            <h2 className={finishedStyles.refTitle}>
              <span>{item.codigo} · {item.nombre}</span>
              <span className={styles.muted}>
                Total: {item.total}
                {can('producto_terminado.ajustar') && <> · <Link to={`/producto-terminado/ajuste?referencia=${item.referencia}`}>Ajustar</Link></>}
              </span>
            </h2>
            <div className={finishedStyles.matrixWrap}>
              <table className={finishedStyles.matrix}>
                <thead>
                  <tr>
                    <th>Color</th>
                    {item.tallas.map((size) => <th key={size}>Talla {size}</th>)}
                    <th className={finishedStyles.totalCol}>Total</th>
                  </tr>
                </thead>
                <tbody>
                  {item.colores.map((row) => (
                    <tr key={row.color}>
                      <th scope="row">{row.color}</th>
                      {item.tallas.map((size) => {
                        const cell = row.tallas[size]
                        if (!cell) return <td key={size} className={finishedStyles.cellMissing}>—</td>
                        return <td key={size} className={cell.cantidad === 0 ? finishedStyles.cellZero : finishedStyles.cellOk}>{cell.cantidad}</td>
                      })}
                      <td className={finishedStyles.totalCol}>{row.total}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ))}
      </section>
    </div>
  )
}
