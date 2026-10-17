import React, { useState, useMemo } from 'react'
import { formatMoney } from '../Inventory/money'
import { prepareLaborLots } from './costSettlement'
import styles from './Settlement.module.css'

export default function LaborCostTab({ manoObra }) {
  const [search, setSearch] = useState('')

  const lots = useMemo(() => prepareLaborLots(manoObra?.por_lote), [manoObra])
  const porEtapa = manoObra?.por_etapa || []

  const filteredLots = useMemo(() => {
    if (!search.trim()) return lots
    const query = search.toLowerCase()
    return lots.filter((l) => l.codigo.toLowerCase().includes(query))
  }, [lots, search])

  const totalNum = parseFloat(manoObra?.total || 0)

  return (
    <div className={styles.tableCard}>
      <div className={styles.tableToolbar}>
        <div className={styles.toolbarTitleBox}>
          <h2>Detalle de Mano de Obra por Lote y Etapa (MOD)</h2>
          <p>
            Cálculo de mano de obra directa: (segundos netos / 60) × tarifa vigente por minuto. Las etapas en curso se indican como provisionales.
          </p>
        </div>

        <div className={styles.filterControls}>
          <input
            type="text"
            className={styles.searchInput}
            placeholder="Buscar por código de lote..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      {/* Resumen Superior por Etapas */}
      <div className={styles.stagesKpiGrid}>
        {porEtapa.map((st) => (
          <div key={st.etapa} className={styles.stageKpiCard}>
            <span className={styles.stageKpiName}>{st.etapa_nombre || st.etapa}</span>
            <span className={styles.stageKpiCost}>{formatMoney(parseFloat(st.costo || 0))}</span>
            <span className={styles.stageKpiTime}>
              {Math.round((st.segundos_netos || 0) / 60)} min invertidos
            </span>
          </div>
        ))}
      </div>

      {/* Listado de Lotes con sus Etapas */}
      <div className={styles.lotsListContainer}>
        {filteredLots.length === 0 ? (
          <div className={styles.emptyTable}>No se encontraron lotes para mostrar.</div>
        ) : (
          filteredLots.map((lote) => (
            <div key={lote.loteId} className={styles.lotAccordionCard}>
              <div className={styles.lotHeaderRow}>
                <div className={styles.lotTitleArea}>
                  <span className={styles.badgeCode}>{lote.codigo}</span>
                  <span className={styles.lotGarmentsCount}>
                    {lote.cantidad} prendas
                  </span>
                </div>
                <div className={styles.lotHeaderTotals}>
                  <span className={styles.lotMaterialsAssigned}>
                    Materiales asignados: <strong>{lote.materialesAsignadosFormatted}</strong>
                  </span>
                  <span className={styles.lotLaborTotal}>
                    Mano de obra: <strong>{lote.totalManoObraFormatted}</strong>
                  </span>
                </div>
              </div>

              <div className={styles.tableWrapper}>
                <table className={styles.subDetailTable}>
                  <thead>
                    <tr>
                      <th>Etapa</th>
                      <th>Estado</th>
                      <th>Tiempo Neto</th>
                      <th className={styles.colMoney}>Tarifa / Minuto</th>
                      <th className={styles.colMoney}>Costo Etapa</th>
                    </tr>
                  </thead>
                  <tbody>
                    {lote.etapas.map((et) => (
                      <tr key={et.etapa}>
                        <td>
                          <strong>{et.nombre}</strong>
                        </td>
                        <td>
                          <span className={styles.badgeState}>{et.estado}</span>
                        </td>
                        <td>{et.tiempoFormatted}</td>
                        <td className={styles.colMoney}>
                          {et.sinTarifa ? (
                            <span className={styles.textWarning}>Sin tarifa</span>
                          ) : (
                            et.tarifaFormatted
                          )}
                        </td>
                        <td className={styles.colMoney}>
                          <strong>{et.costoFormatted}</strong>
                          {et.provisional && (
                            <span className={styles.pillProvisional} title="Etapa en curso, tiempo creciendo">
                              Provisional
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))
        )}
      </div>

      <div className={styles.totalLaborFooter}>
        <span>TOTAL MANO DE OBRA DIRECTA</span>
        <strong className={styles.totalHighlight}>{formatMoney(totalNum)}</strong>
      </div>
    </div>
  )
}
