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

export default function LaborCostTab({ order }) {
  const [search, setSearch] = useState('')
  const [selectedType, setSelectedType] = useState('TODOS')

  const filteredItems = useMemo(() => {
    return order.mano_obra_detalle.filter((item) => {
      const matchesSearch =
        item.operacion.toLowerCase().includes(search.toLowerCase()) ||
        item.taller_o_modulo.toLowerCase().includes(search.toLowerCase()) ||
        item.fase.toLowerCase().includes(search.toLowerCase())
      const matchesType = selectedType === 'TODOS' || item.tipo === selectedType
      return matchesSearch && matchesType
    })
  }, [order, search, selectedType])

  const totalPresupuestado = filteredItems.reduce((acc, it) => acc + it.subtotal_presupuestado, 0)
  const totalReal = filteredItems.reduce((acc, it) => acc + it.subtotal_real, 0)
  const variacionTotal = totalReal - totalPresupuestado

  // Comparativa Planta vs Satélites
  const totalInterno = order.mano_obra_detalle
    .filter((it) => it.tipo === 'INTERNO')
    .reduce((acc, it) => acc + it.subtotal_real, 0)
  const totalExterno = order.mano_obra_detalle
    .filter((it) => it.tipo === 'EXTERNO')
    .reduce((acc, it) => acc + it.subtotal_real, 0)

  return (
    <div className={styles.tableCard}>
      {/* Barra de Herramientas y Filtros */}
      <div className={styles.tableToolbar}>
        <div className={styles.toolbarTitleBox}>
          <h2>Detalle de Costo de Mano de Obra (MOD)</h2>
          <p>
            Operaciones de planta y satélites externos: tiempos estándar (SAM), tarifas por prenda y costos liquidados.
          </p>
        </div>

        <div className={styles.filterControls}>
          <input
            type="text"
            className={styles.searchInput}
            placeholder="Buscar operación o taller..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />

          <select
            className={styles.selectFilter}
            value={selectedType}
            onChange={(e) => setSelectedType(e.target.value)}
          >
            <option value="TODOS">Todas las modalidades</option>
            <option value="INTERNO">Planta Interna (TexCore)</option>
            <option value="EXTERNO">Satélites & Terceros</option>
          </select>
        </div>
      </div>

      {/* Mini Resumen: Planta vs Satélites */}
      <div className={styles.versusStatList} style={{ flexDirection: 'row', gap: '2rem', marginBottom: '1.25rem' }}>
        <div className={styles.legendItem}>
          <span className={`${styles.statusPill} ${styles.pillInternal}`}>Planta Interna:</span>
          <strong>{formatCOP(totalInterno)}</strong> ({formatPct((totalInterno / (totalInterno + totalExterno)) * 100)})
        </div>
        <div className={styles.legendItem}>
          <span className={`${styles.statusPill} ${styles.pillExternal}`}>Satélites & Lavandería:</span>
          <strong>{formatCOP(totalExterno)}</strong> ({formatPct((totalExterno / (totalInterno + totalExterno)) * 100)})
        </div>
      </div>

      {/* Tabla de Mano de Obra */}
      <div className={styles.tableContainer}>
        <table className={styles.dataTable}>
          <thead>
            <tr>
              <th>Fase / Operación</th>
              <th>Modalidad</th>
              <th>Taller / Módulo</th>
              <th className={styles.numeric}>SAM (min/und)</th>
              <th className={styles.numeric}>Tarifa Prenda</th>
              <th className={styles.numeric}>Prendas</th>
              <th className={styles.numeric}>Presupuestado</th>
              <th className={styles.numeric}>Real Liquidado</th>
              <th className={styles.numeric}>Variación</th>
              <th className={styles.centerCol}>Eficiencia</th>
              <th>Observación Técnica</th>
            </tr>
          </thead>
          <tbody>
            {filteredItems.map((item) => {
              const hasDiff = item.variacion !== 0
              const isOver = item.variacion > 0
              return (
                <tr key={item.id}>
                  <td>
                    <strong>{item.operacion}</strong>
                    <span className={styles.subDetailText}>Fase: {item.fase}</span>
                  </td>
                  <td>
                    <span
                      className={`${styles.statusPill} ${
                        item.tipo === 'INTERNO' ? styles.pillInternal : styles.pillExternal
                      }`}
                    >
                      {item.tipo === 'INTERNO' ? 'Planta Interna' : 'Satélite / Tercero'}
                    </span>
                  </td>
                  <td>
                    <strong>{item.taller_o_modulo}</strong>
                    <span className={styles.subDetailText}>{item.responsable}</span>
                  </td>
                  <td className={styles.numeric}>
                    {item.sam_real > 0 ? `${item.sam_real} min` : 'N/A'}
                    {item.sam_estandar > 0 && (
                      <span className={styles.subDetailText}>Std: {item.sam_estandar} min</span>
                    )}
                  </td>
                  <td className={styles.numeric}>{formatCOP(item.tarifa_und)}</td>
                  <td className={styles.numeric}>{item.prendas_procesadas} und</td>
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
                        item.eficiencia_pct >= 98
                          ? styles.pillSuccess
                          : item.eficiencia_pct >= 93
                          ? styles.pillWarning
                          : styles.pillDanger
                      }`}
                    >
                      {item.eficiencia_pct}%
                    </span>
                  </td>
                  <td>
                    <span className={styles.subDetailText} style={{ maxWidth: '240px' }}>
                      {item.observacion}
                    </span>
                  </td>
                </tr>
              )
            })}
          </tbody>
          <tfoot>
            <tr className={styles.tableTotalRow}>
              <td colSpan={6}>Total Mano de Obra ({filteredItems.length} operaciones)</td>
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
