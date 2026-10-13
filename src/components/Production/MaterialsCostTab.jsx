import React, { useState, useMemo } from 'react'
import styles from './Production.module.css'

const formatCOP = (val) => {
  const num = Number(val) || 0
  return `$ ${num.toLocaleString('es-CO', { maximumFractionDigits: 0 })}`
}

const formatPct = (val) => {
  const num = Number(val) || 0
  return `${num.toLocaleString('es-CO', { minimumFractionDigits: 1, maximumFractionDigits: 2 })}%`
}

export default function MaterialsCostTab({ order }) {
  const [search, setSearch] = useState('')
  const [selectedCategory, setSelectedCategory] = useState('TODAS')

  const categories = useMemo(() => {
    const set = new Set(order.materiales_detalle.map((item) => item.categoria))
    return ['TODAS', ...Array.from(set)]
  }, [order])

  const filteredItems = useMemo(() => {
    return order.materiales_detalle.filter((item) => {
      const matchesSearch =
        item.nombre.toLowerCase().includes(search.toLowerCase()) ||
        item.codigo.toLowerCase().includes(search.toLowerCase())
      const matchesCategory = selectedCategory === 'TODAS' || item.categoria === selectedCategory
      return matchesSearch && matchesCategory
    })
  }, [order, search, selectedCategory])

  const totalPresupuestado = filteredItems.reduce((acc, it) => acc + it.subtotal_presupuestado, 0)
  const totalReal = filteredItems.reduce((acc, it) => acc + it.subtotal_real, 0)
  const variacionTotal = totalReal - totalPresupuestado

  return (
    <div className={styles.tableCard}>
      {/* Barra de Herramientas y Filtros */}
      <div className={styles.tableToolbar}>
        <div className={styles.toolbarTitleBox}>
          <h2>Detalle de Costo de Materiales e Insumos</h2>
          <p>Kardex de salida, consumos reales por prenda y desviación frente al presupuesto estándar.</p>
        </div>

        <div className={styles.filterControls}>
          <input
            type="text"
            className={styles.searchInput}
            placeholder="Buscar material o código..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />

          <select
            className={styles.selectFilter}
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
          >
            {categories.map((cat) => (
              <option key={cat} value={cat}>
                {cat === 'TODAS' ? 'Todas las categorías' : cat}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Tabla de Materiales */}
      <div className={styles.tableContainer}>
        <table className={styles.dataTable}>
          <thead>
            <tr>
              <th>Material / Insumo</th>
              <th>Categoría</th>
              <th className={styles.numeric}>Consumo x Prenda</th>
              <th className={styles.numeric}>Cant. Presup.</th>
              <th className={styles.numeric}>Cant. Real</th>
              <th className={styles.numeric}>Costo Unit.</th>
              <th className={styles.numeric}>Subtotal Presup.</th>
              <th className={styles.numeric}>Subtotal Real</th>
              <th className={styles.numeric}>Variación</th>
              <th className={styles.centerCol}>Estado</th>
              <th>Observación de Almacén</th>
            </tr>
          </thead>
          <tbody>
            {filteredItems.map((item) => {
              const hasDiff = item.variacion !== 0
              const isOver = item.variacion > 0
              return (
                <tr key={item.id}>
                  <td>
                    <strong>{item.nombre}</strong>
                    <span className={styles.subDetailText}>
                      <span className={styles.codeMuted}>{item.codigo}</span> • {item.incidencia_pct}% del total
                    </span>
                  </td>
                  <td>
                    <span className={`${styles.statusPill} ${styles.pillNeutral}`}>{item.categoria}</span>
                  </td>
                  <td className={styles.numeric}>
                    {item.consumo_real_und} {item.unidad}
                    <span className={styles.subDetailText}>Std: {item.consumo_estandar_und}</span>
                  </td>
                  <td className={styles.numeric}>
                    {item.cant_presupuestada.toLocaleString('es-CO')} {item.unidad}
                  </td>
                  <td className={styles.numeric}>
                    <strong>
                      {item.cant_real.toLocaleString('es-CO')} {item.unidad}
                    </strong>
                  </td>
                  <td className={styles.numeric}>{formatCOP(item.costo_unitario)}</td>
                  <td className={styles.numeric}>{formatCOP(item.subtotal_presupuestado)}</td>
                  <td className={styles.numeric}>
                    <strong>{formatCOP(item.subtotal_real)}</strong>
                  </td>
                  <td
                    className={styles.numeric}
                    style={{ color: !hasDiff ? '#64748b' : isOver ? '#b91c1c' : '#047857', fontWeight: 700 }}
                  >
                    {!hasDiff ? '—' : `${isOver ? '+' : ''}${formatCOP(item.variacion)} (${formatPct(item.variacion_pct)})`}
                  </td>
                  <td className={styles.centerCol}>
                    <span
                      className={`${styles.statusPill} ${
                        item.estado === 'AHORRO'
                          ? styles.pillSuccess
                          : item.estado === 'EXCEDIDO'
                          ? styles.pillDanger
                          : styles.pillNeutral
                      }`}
                    >
                      {item.estado}
                    </span>
                  </td>
                  <td>
                    <span className={styles.subDetailText} style={{ maxWidth: '240px' }}>
                      {item.observacion || 'Sin observaciones'}
                    </span>
                  </td>
                </tr>
              )
            })}
          </tbody>
          <tfoot>
            <tr className={styles.tableTotalRow}>
              <td colSpan={6}>Total Materiales ({filteredItems.length} items)</td>
              <td className={styles.numeric}>{formatCOP(totalPresupuestado)}</td>
              <td className={styles.numeric}>{formatCOP(totalReal)}</td>
              <td
                className={styles.numeric}
                style={{ color: variacionTotal > 0 ? '#b91c1c' : '#047857' }}
              >
                {variacionTotal > 0 ? '+' : ''}{formatCOP(variacionTotal)}
              </td>
              <td colSpan={2} />
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  )
}
