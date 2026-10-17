import React, { useState, useMemo } from 'react'
import { formatMoney } from '../Inventory/money'
import { prepareMaterialRows } from './costSettlement'
import styles from './Settlement.module.css'

export default function MaterialsCostTab({ lineas, total }) {
  const [search, setSearch] = useState('')

  const rows = useMemo(() => prepareMaterialRows(lineas), [lineas])

  const filteredRows = useMemo(() => {
    if (!search.trim()) return rows
    const query = search.toLowerCase()
    return rows.filter(
      (r) => r.nombre.toLowerCase().includes(query) || r.codigo.toLowerCase().includes(query)
    )
  }, [rows, search])

  const totalNum = parseFloat(total || 0)

  return (
    <div className={styles.tableCard}>
      <div className={styles.tableToolbar}>
        <div className={styles.toolbarTitleBox}>
          <h2>Detalle de Costo de Materiales e Insumos</h2>
          <p>
            Materiales descontados del almacén según la ficha técnica. El costo unitario refleja la foto tomada de la compra / promedio ponderado.
          </p>
        </div>

        <div className={styles.filterControls}>
          <input
            type="text"
            className={styles.searchInput}
            placeholder="Buscar por nombre o código..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      <div className={styles.tableWrapper}>
        <table className={styles.detailTable}>
          <thead>
            <tr>
              <th>Código</th>
              <th>Material / Insumo</th>
              <th>Unidad</th>
              <th>Cantidad Consumida</th>
              <th className={styles.colMoney}>Costo Unitario</th>
              <th className={styles.colMoney}>Subtotal Costo</th>
              <th>Estado</th>
            </tr>
          </thead>
          <tbody>
            {filteredRows.length === 0 ? (
              <tr>
                <td colSpan={7} className={styles.emptyTable}>
                  No se encontraron materiales que coincidan con la búsqueda.
                </td>
              </tr>
            ) : (
              filteredRows.map((m) => (
                <tr key={m.id}>
                  <td>
                    <span className={styles.badgeCode}>{m.codigo}</span>
                  </td>
                  <td>
                    <strong>{m.nombre}</strong>
                  </td>
                  <td>{m.unidad}</td>
                  <td>{m.cantidad}</td>
                  <td className={styles.colMoney}>
                    {m.sinCosto ? (
                      <span className={styles.textWarning}>Sin costo</span>
                    ) : (
                      m.costoUnitarioFormatted
                    )}
                  </td>
                  <td className={styles.colMoney}>
                    <strong>{m.subtotalFormatted}</strong>
                  </td>
                  <td>
                    <span className={`${styles.statusPill} ${m.sinCosto ? styles.pillWarning : styles.pillSuccess}`}>
                      {m.statusBadge}
                    </span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
          <tfoot>
            <tr className={styles.totalRow}>
              <td colSpan={5}>
                <strong>TOTAL MATERIALES E INSUMOS</strong>
              </td>
              <td className={styles.colMoney}>
                <strong className={styles.totalHighlight}>{formatMoney(totalNum)}</strong>
              </td>
              <td />
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  )
}
