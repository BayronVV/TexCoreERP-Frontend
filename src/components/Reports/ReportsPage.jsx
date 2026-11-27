import { useCallback, useEffect, useMemo, useState } from 'react'
import { apiGet, apiRequest } from '../../api/client'
import { useAuth } from '../../auth/session'
import { usePersistedFilters } from '../ui/usePersistedFilters'
import { useToast } from '../ui/toastContext'
import { formatDate } from '../Inventory/labels'
import styles from '../Inventory/Inventory.module.css'
import reportStyles from './Reports.module.css'
import {
  buildReportQueryParams,
  colombiaTodayISO,
  exportReportToExcel,
  exportTabToCsv,
  filterReferencesByJeanType,
  getActiveTabRows,
  INITIAL_FILTERS,
  money,
  number,
  quickRangeDates,
  REPORT_TABS,
} from './reports'

function statusPillClass(code) {
  if (code === 'COMPLETADA' || code === 'PAGADO') {
    return `${reportStyles.statusPill} ${reportStyles.pillDone}`
  }
  if (code === 'ANULADA' || code === 'DEVOLUCION') {
    return `${reportStyles.statusPill} ${reportStyles.pillCancelled}`
  }
  return `${reportStyles.statusPill} ${reportStyles.pillOpen}`
}

/**
 * Reportes · Tablero gerencial, ruta `/reportes` (`reportes.ver`): cuatro pestañas (consolidado por tipo de jean, órdenes de producción, ventas por
 * referencia y detalle de ventas) con filtros avanzados, actualización de las vistas analíticas y exportación a Excel (.xlsx) o CSV, generadas en el navegador.
 * Endpoints: `GET /api/reportes/metadatos/`, `GET /api/reportes/gerencial/` (con los filtros como query) y `POST /api/reportes/refrescar/`.
 */
const ReportsPage = () => {
  const notify = useToast()
  const { can } = useAuth()
  const [meta, setMeta] = useState({
    tipos_jean: [],
    estados_orden: [],
    estados_cobro: [],
    tipos_cliente: [],
    vendedores: [],
    transportadoras: [],
    referencias: [],
  })
  const {
    filters,
    activeCount: filterCount,
    updateFilters,
    clearFilters,
  } = usePersistedFilters('texcore_filters_reports', INITIAL_FILTERS)
  const [activeTab, setActiveTab] = useState('consolidado')
  const [report, setReport] = useState(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    apiGet('/api/reportes/metadatos/')
      .then((data) => setMeta(data))
      .catch(() => {})
  }, [])

  const loadReport = useCallback(async (currentFilters) => {
    setLoading(true)
    setError('')
    try {
      const qs = buildReportQueryParams(currentFilters)
      const data = await apiGet(`/api/reportes/gerencial/${qs}`)
      setReport(data)
    } catch (failure) {
      setError(failure.message || 'No se pudo cargar el tablero de reportes gerenciales.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadReport(filters)
  }, [filters, loadReport])

  const filteredReferences = useMemo(
    () => filterReferencesByJeanType(meta.referencias, filters.tipo_jean),
    [meta.referencias, filters.tipo_jean],
  )

  const handleFilterChange = (field, value) => {
    updateFilters((prev) => {
      const next = { ...prev, [field]: value }
      if (field === 'tipo_jean' && value) {
        const currentRef = meta.referencias.find((r) => String(r.id) === String(prev.referencia))
        if (currentRef && currentRef.ajuste !== value) {
          next.referencia = ''
        }
      }
      return next
    })
  }

  const applyQuickRange = (days) => {
    const range = quickRangeDates(days)
    updateFilters((prev) => ({ ...prev, ...range }))
  }

  const handleRefreshViews = async () => {
    setRefreshing(true)
    try {
      await apiRequest('/api/reportes/refrescar/', { method: 'POST' })
      await loadReport(filters)
      notify('Indicadores y vistas analíticas actualizados.')
    } catch (failure) {
      notify(failure.message || 'No se pudieron actualizar las vistas analíticas.', 'error')
    } finally {
      setRefreshing(false)
    }
  }

  const handleExportExcel = () => {
    if (!report) return
    exportReportToExcel(report, activeTab, colombiaTodayISO())
    notify('Archivo Excel (.xlsx) generado y descargado.')
  }

  const handleExportCsv = () => {
    if (!report) return
    exportTabToCsv(report, activeTab, colombiaTodayISO())
    notify('Archivo CSV (.csv) de la vista actual descargado.')
  }

  const kpis = report?.kpis || {}
  const activeRows = getActiveTabRows(report, activeTab)

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div>
          <p className={styles.eyebrow}>Reportes y Analítica</p>
          <h1>Tablero de Reportes Gerenciales</h1>
          <p className={styles.subtitle}>
            Consulta el desempeño consolidado de producción, calidad, ventas y cartera utilizando filtros avanzados, y exporta los resultados a Excel o CSV.
          </p>
        </div>
        <div className={reportStyles.exportBar}>
          {can('reportes.gestionar') && (
            <button
              type="button"
              className={styles.secondaryButton}
              onClick={handleRefreshViews}
              disabled={refreshing || loading}
            >
              {refreshing ? 'Actualizando…' : 'Actualizar datos'}
            </button>
          )}
          <button
            type="button"
            className={reportStyles.exportExcelBtn}
            onClick={handleExportExcel}
            disabled={loading || !report}
          >
            Exportar Excel (.xlsx)
          </button>
          <button
            type="button"
            className={reportStyles.exportCsvBtn}
            onClick={handleExportCsv}
            disabled={loading || activeRows.length === 0}
          >
            Exportar CSV (.csv)
          </button>
        </div>
      </header>

      {/* Barra de filtros avanzados */}
      <section className={reportStyles.filterCard} aria-label="Filtros avanzados del reporte">
        <div className={reportStyles.filterHeader}>
          <div className={reportStyles.filterTitleGroup}>
            <h3>Filtros avanzados</h3>
            {filterCount > 0 && (
              <span className={reportStyles.filterBadge}>
                {filterCount} {filterCount === 1 ? 'filtro activo' : 'filtros activos'}
              </span>
            )}
          </div>
          <div className={reportStyles.quickRanges}>
            <button type="button" className={reportStyles.quickBtn} onClick={() => applyQuickRange(7)}>
              Últimos 7 días
            </button>
            <button type="button" className={reportStyles.quickBtn} onClick={() => applyQuickRange(30)}>
              Últimos 30 días
            </button>
            <button type="button" className={reportStyles.quickBtn} onClick={() => applyQuickRange('month')}>
              Este mes
            </button>
            <button type="button" className={reportStyles.quickBtn} onClick={() => applyQuickRange(null)}>
              Todo el historial
            </button>
            {filterCount > 0 && (
              <button type="button" className={styles.secondaryButton} onClick={clearFilters}>
                Limpiar filtros
              </button>
            )}
          </div>
        </div>

        <div className={reportStyles.filterGrid}>
          <label className={styles.field}>
            Desde
            <input
              type="date"
              value={filters.desde}
              onChange={(e) => handleFilterChange('desde', e.target.value)}
            />
          </label>

          <label className={styles.field}>
            Hasta
            <input
              type="date"
              value={filters.hasta}
              onChange={(e) => handleFilterChange('hasta', e.target.value)}
            />
          </label>

          <label className={styles.field}>
            Tipo de jean (Silueta)
            <select
              value={filters.tipo_jean}
              onChange={(e) => handleFilterChange('tipo_jean', e.target.value)}
            >
              <option value="">Todos los tipos de jean</option>
              {meta.tipos_jean.map((item) => (
                <option key={item.codigo} value={item.codigo}>
                  {item.nombre}
                </option>
              ))}
            </select>
          </label>

          <label className={styles.field}>
            Referencia de jean
            <select
              value={filters.referencia}
              onChange={(e) => handleFilterChange('referencia', e.target.value)}
            >
              <option value="">Todas las referencias</option>
              {filteredReferences.map((ref) => (
                <option key={ref.id} value={ref.id}>
                  {ref.codigo} · {ref.nombre} ({ref.ajuste_nombre})
                </option>
              ))}
            </select>
          </label>

          <label className={styles.field}>
            Estado de orden (Producción)
            <select
              value={filters.estado_orden}
              onChange={(e) => handleFilterChange('estado_orden', e.target.value)}
            >
              <option value="">Todos los estados</option>
              {meta.estados_orden.map((st) => (
                <option key={st.codigo} value={st.codigo}>
                  {st.nombre}
                </option>
              ))}
            </select>
          </label>

          <label className={styles.field}>
            Estado de cobro (Ventas)
            <select
              value={filters.estado_cobro}
              onChange={(e) => handleFilterChange('estado_cobro', e.target.value)}
            >
              <option value="">Todos los estados</option>
              {meta.estados_cobro.map((st) => (
                <option key={st.codigo} value={st.codigo}>
                  {st.nombre}
                </option>
              ))}
            </select>
          </label>

          <label className={styles.field}>
            Tipo de cliente
            <select
              value={filters.tipo_cliente}
              onChange={(e) => handleFilterChange('tipo_cliente', e.target.value)}
            >
              <option value="">Todos los clientes</option>
              {meta.tipos_cliente.map((cl) => (
                <option key={cl.codigo} value={cl.codigo}>
                  {cl.nombre}
                </option>
              ))}
            </select>
          </label>

          <label className={styles.field}>
            Vendedor
            <select
              value={filters.vendedor}
              onChange={(e) => handleFilterChange('vendedor', e.target.value)}
              aria-label="Filtrar por vendedor"
            >
              <option value="">Todos los vendedores</option>
              {(meta.vendedores ?? []).map((seller) => (
                <option key={seller.id} value={seller.id}>
                  {seller.nombre}
                </option>
              ))}
            </select>
          </label>

          <label className={styles.field}>
            Transportadora
            <select
              value={filters.transportadora}
              onChange={(e) => handleFilterChange('transportadora', e.target.value)}
              aria-label="Filtrar por transportadora"
            >
              <option value="">Todas las transportadoras</option>
              {(meta.transportadoras ?? []).map((carrier) => (
                <option key={carrier.codigo} value={carrier.codigo}>
                  {carrier.nombre}
                </option>
              ))}
            </select>
          </label>
        </div>
      </section>

      {error && <p className={styles.errorBanner}>{error}</p>}

      {/* Tarjetas de resumen ejecutivo */}
      <section className={reportStyles.kpiGrid} aria-label="Indicadores clave de gestión">
        <div className={`${reportStyles.kpiCard} ${reportStyles.kpiHighlight}`}>
          <span className={reportStyles.kpiLabel}>Ingresos por ventas</span>
          <strong className={reportStyles.kpiValue}>{money(kpis.ingresos_totales)}</strong>
          <span className={reportStyles.kpiSub}>
            {number(kpis.facturas_emitidas)} factura(s) · {number(kpis.unidades_vendidas)} prenda(s)
          </span>
        </div>

        <div className={`${reportStyles.kpiCard} ${reportStyles.kpiSuccess}`}>
          <span className={reportStyles.kpiLabel}>Utilidad bruta estimada</span>
          <strong className={reportStyles.kpiValue}>{money(kpis.utilidad_bruta)}</strong>
          <span className={reportStyles.kpiSub}>
            Saldo en caja empresa: {money(kpis.saldo_financiero_empresa)}
          </span>
        </div>

        <div className={reportStyles.kpiCard}>
          <span className={reportStyles.kpiLabel}>Estado de cartera del periodo</span>
          <strong className={reportStyles.kpiValue}>{money(kpis.recaudado_periodo)}</strong>
          <span className={reportStyles.kpiSub}>
            Recaudado · Por cobrar: {money(kpis.pendiente_recaudo_periodo)}
          </span>
        </div>

        <div className={reportStyles.kpiCard}>
          <span className={reportStyles.kpiLabel}>Producción y calidad</span>
          <strong className={reportStyles.kpiValue}>{number(kpis.prendas_aptas)} aptas</strong>
          <span className={reportStyles.kpiSub}>
            {number(kpis.total_ordenes)} orden(es) · {number(kpis.prendas_marras)} marra(s) ({kpis.tasa_calidad_pct ?? 100}% calidad)
          </span>
        </div>

        <div className={reportStyles.kpiCard}>
          <span className={reportStyles.kpiLabel}>Devoluciones por vendedor</span>
          <strong className={reportStyles.kpiValue}>{money(kpis.flete_devoluciones_total)}</strong>
          <span className={reportStyles.kpiSub}>
            {number(kpis.devoluciones_guias)} guía(s) devuelta(s) · Solo informativo
          </span>
        </div>
      </section>

      {/* Pestañas de vistas analíticas */}
      <div className={reportStyles.toolbarRow}>
        <div className={reportStyles.tabsBar} role="tablist" aria-label="Secciones del reporte">
          {REPORT_TABS.map((tab) => {
            const count = getActiveTabRows(report, tab.id).length
            return (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={activeTab === tab.id}
                className={`${reportStyles.tabBtn} ${activeTab === tab.id ? reportStyles.tabBtnActive : ''}`}
                onClick={() => setActiveTab(tab.id)}
              >
                {tab.label} ({count})
              </button>
            )
          })}
        </div>
      </div>

      {/* Tabla principal de resultados */}
      <section className={styles.card}>
        {loading ? (
          <p className={styles.empty}>Consultando vistas analíticas…</p>
        ) : activeRows.length === 0 ? (
          <p className={styles.empty}>
            No se encontraron registros para los filtros seleccionados. Ajusta el rango de fechas, tipo de jean o estado de orden.
          </p>
        ) : (
          <>
            {activeTab === 'consolidado' && (
              <div className={styles.tableWrap}>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th>Tipo de Jean (Silueta)</th>
                      <th className={styles.numCol}>Órdenes Prod.</th>
                      <th className={styles.numCol}>Planificadas</th>
                      <th className={styles.numCol}>Aptas (1ra)</th>
                      <th className={styles.numCol}>Marras</th>
                      <th className={styles.numCol}>Unid. Vendidas</th>
                      <th className={styles.numCol}>Ingresos Ventas</th>
                      <th className={styles.numCol}>Utilidad Bruta</th>
                    </tr>
                  </thead>
                  <tbody>
                    {activeRows.map((row) => (
                      <tr key={row.tipo_jean}>
                        <td>
                          <span className={reportStyles.silhouetteTag}>{row.tipo_jean_nombre}</span>
                        </td>
                        <td className={styles.numCol}>{number(row.ordenes_count)}</td>
                        <td className={styles.numCol}>{number(row.prendas_planificadas)}</td>
                        <td className={styles.numCol}>
                          <strong>{number(row.prendas_aptas)}</strong>
                        </td>
                        <td className={styles.numCol}>{number(row.prendas_marras)}</td>
                        <td className={styles.numCol}>
                          <strong>{number(row.unidades_vendidas)}</strong>
                        </td>
                        <td className={styles.numCol}>
                          <strong>{money(row.ingresos_totales)}</strong>
                        </td>
                        <td className={styles.numCol}>{money(row.utilidad_bruta)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {activeTab === 'produccion' && (
              <div className={styles.tableWrap}>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th>Orden</th>
                      <th>Fecha Salida</th>
                      <th>Estado de Orden</th>
                      <th>Referencia</th>
                      <th>Tipo de Jean</th>
                      <th>Responsable</th>
                      <th className={styles.numCol}>Planificadas</th>
                      <th className={styles.numCol}>Lotes</th>
                      <th className={styles.numCol}>Aptas</th>
                      <th className={styles.numCol}>Marras</th>
                      <th className={styles.numCol}>Calidad</th>
                    </tr>
                  </thead>
                  <tbody>
                    {activeRows.map((row) => (
                      <tr key={row.orden_id}>
                        <td>
                          <strong>{row.codigo}</strong>
                        </td>
                        <td>{formatDate(row.fecha_salida)}</td>
                        <td>
                          <span className={statusPillClass(row.estado_orden)}>
                            {row.estado_orden_nombre}
                          </span>
                        </td>
                        <td>
                          <strong>{row.referencia_codigo}</strong> · {row.referencia_nombre}
                        </td>
                        <td>
                          <span className={reportStyles.silhouetteTag}>{row.tipo_jean_nombre}</span>
                        </td>
                        <td>{row.responsable}</td>
                        <td className={styles.numCol}>{number(row.prendas_planificadas)}</td>
                        <td className={styles.numCol}>
                          {number(row.total_lotes)} ({number(row.prendas_en_lotes)} uds)
                        </td>
                        <td className={styles.numCol}>
                          <strong>{number(row.prendas_aptas)}</strong>
                        </td>
                        <td className={styles.numCol}>{number(row.prendas_marras)}</td>
                        <td className={styles.numCol}>{row.tasa_calidad_pct}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {activeTab === 'ventas_ref' && (
              <div className={styles.tableWrap}>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th>Referencia</th>
                      <th>Tipo de Jean</th>
                      <th className={styles.numCol}>Facturas</th>
                      <th className={styles.numCol}>Unidades</th>
                      <th className={styles.numCol}>Subtotal</th>
                      <th className={styles.numCol}>Descuentos</th>
                      <th className={styles.numCol}>Base Gravable</th>
                      <th className={styles.numCol}>IVA</th>
                      <th className={styles.numCol}>Total Facturado</th>
                      <th className={styles.numCol}>Utilidad Bruta</th>
                      <th className={styles.numCol}>Margen</th>
                    </tr>
                  </thead>
                  <tbody>
                    {activeRows.map((row) => (
                      <tr key={row.referencia_id}>
                        <td>
                          <strong>{row.referencia_codigo}</strong> · {row.referencia_nombre}
                        </td>
                        <td>
                          <span className={reportStyles.silhouetteTag}>{row.tipo_jean_nombre}</span>
                        </td>
                        <td className={styles.numCol}>{number(row.facturas_count)}</td>
                        <td className={styles.numCol}>
                          <strong>{number(row.unidades_vendidas)}</strong>
                        </td>
                        <td className={styles.numCol}>{money(row.subtotal_bruto)}</td>
                        <td className={styles.numCol}>{money(row.descuento_total)}</td>
                        <td className={styles.numCol}>{money(row.base_gravable)}</td>
                        <td className={styles.numCol}>{money(row.iva_total)}</td>
                        <td className={styles.numCol}>
                          <strong>{money(row.ingresos_totales)}</strong>
                        </td>
                        <td className={styles.numCol}>{money(row.utilidad_bruta)}</td>
                        <td className={styles.numCol}>{row.margen_pct}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {activeTab === 'ventas_det' && (
              <div className={styles.tableWrap}>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th>Factura</th>
                      <th>Fecha</th>
                      <th>Cliente</th>
                      <th>Estado Cobro</th>
                      <th>Referencia</th>
                      <th>Tipo de Jean</th>
                      <th>Variante</th>
                      <th className={styles.numCol}>Unidades</th>
                      <th className={styles.numCol}>Base Gravable</th>
                      <th className={styles.numCol}>Total Línea</th>
                    </tr>
                  </thead>
                  <tbody>
                    {activeRows.map((row) => (
                      <tr key={row.linea_id}>
                        <td>
                          <strong>{row.numero_factura}</strong>
                        </td>
                        <td>{formatDate(row.fecha)}</td>
                        <td>
                          {row.cliente_nombre}{' '}
                          <span className={styles.muted}>({row.cliente_tipo_nombre})</span>
                        </td>
                        <td>
                          <span className={statusPillClass(row.estado_cobro)}>
                            {row.estado_cobro_nombre}
                          </span>
                        </td>
                        <td>
                          <strong>{row.referencia_codigo}</strong> · {row.referencia_nombre}
                        </td>
                        <td>
                          <span className={reportStyles.silhouetteTag}>{row.tipo_jean_nombre}</span>
                        </td>
                        <td>
                          Talla {row.talla} · {row.color}
                        </td>
                        <td className={styles.numCol}>
                          <strong>{number(row.unidades)}</strong>
                        </td>
                        <td className={styles.numCol}>{money(row.base_gravable)}</td>
                        <td className={styles.numCol}>
                          <strong>{money(row.total)}</strong>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {activeTab === 'devoluciones' && (
              <>
                <p className={styles.muted} style={{ marginBottom: '0.75rem' }}>
                  Reporte informativo de devoluciones por vendedor y fletes a su cargo; el sistema no realiza descuentos automáticos.
                </p>
                <div className={styles.tableWrap}>
                  <table className={styles.table}>
                    <thead>
                      <tr>
                        <th>Vendedor</th>
                        <th className={styles.numCol}>Guías Devueltas</th>
                        <th className={styles.numCol}>Flete a Cargo del Vendedor</th>
                      </tr>
                    </thead>
                    <tbody>
                      {activeRows.map((row) => (
                        <tr key={row.vendedor_id ?? row.vendedor_nombre}>
                          <td><strong>{row.vendedor_nombre}</strong></td>
                          <td className={styles.numCol}>{number(row.guias_devueltas)}</td>
                          <td className={styles.numCol}><strong>{money(row.flete_vendedor)}</strong></td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr>
                        <th>Total</th>
                        <th className={styles.numCol}>{number(kpis.devoluciones_guias)}</th>
                        <th className={styles.numCol}>{money(kpis.flete_devoluciones_total)}</th>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </>
            )}

            <div className={reportStyles.summaryFooter}>
              <span>
                Mostrando <strong>{activeRows.length}</strong> registro(s) en la vista seleccionada.
              </span>
              <span>
                Datos servidos desde vistas SQL analíticas pre-agregadas para consulta gerencial de alto rendimiento.
              </span>
            </div>
          </>
        )}
      </section>
    </div>
  )
}

export default ReportsPage

