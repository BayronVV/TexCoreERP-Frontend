import React, { useState, useEffect, useCallback } from 'react'
import { apiGet } from '../../api/client'
import { formatMoney } from '../Inventory/money'
import { parseCostingSummary, formatPercentage } from './costSettlement'
import SettlementOverviewTab from './SettlementOverviewTab'
import MaterialsCostTab from './MaterialsCostTab'
import LaborCostTab from './LaborCostTab'
import LaborRatesTab from './LaborRatesTab'
import { useToast } from '../ui/toastContext'
import styles from './Settlement.module.css'

export default function OrderSettlementPage() {
  const notify = useToast()

  const [orders, setOrders] = useState([])
  const [selectedOrderId, setSelectedOrderId] = useState(null)
  const [costosData, setCostosData] = useState(null)
  const [rates, setRates] = useState([])
  const [activeTab, setActiveTab] = useState('resumen')
  const [loading, setLoading] = useState(true)
  const [loadingCostos, setLoadingCostos] = useState(false)
  const [errorMsg, setErrorMsg] = useState(null)

  // Cargar lista de órdenes de producción
  const loadOrders = useCallback(async () => {
    try {
      setLoading(true)
      const data = await apiGet('/api/produccion/ordenes/')
      if (Array.isArray(data)) {
        setOrders(data)
        if (data.length > 0 && !selectedOrderId) {
          setSelectedOrderId(data[0].id)
        }
      }
    } catch (err) {
      setErrorMsg(err.message || 'No se pudieron cargar las órdenes de producción.')
    } finally {
      setLoading(false)
    }
  }, [selectedOrderId])

  // Cargar tarifas de mano de obra
  const loadRates = useCallback(async () => {
    try {
      const data = await apiGet('/api/produccion/tarifas/')
      if (Array.isArray(data)) {
        setRates(data)
      }
    } catch {
      // Si falla la carga de tarifas, se mantiene vacío
    }
  }, [])

  // Cargar costos de la orden seleccionada
  const loadCostos = useCallback(async (orderId) => {
    if (!orderId) return
    try {
      setLoadingCostos(true)
      setErrorMsg(null)
      const data = await apiGet(`/api/produccion/ordenes/${orderId}/costos/`)
      setCostosData(data)
    } catch (err) {
      setErrorMsg(err.message || 'Error al obtener los costos de la orden.')
      setCostosData(null)
    } finally {
      setLoadingCostos(false)
    }
  }, [])

  useEffect(() => {
    loadOrders()
    loadRates()
  }, [loadOrders, loadRates])

  useEffect(() => {
    if (selectedOrderId) {
      loadCostos(selectedOrderId)
    }
  }, [selectedOrderId, loadCostos])

  const handleOrderChange = (e) => {
    const id = Number(e.target.value)
    setSelectedOrderId(id)
  }

  const handlePrint = () => {
    window.print()
  }

  const summary = parseCostingSummary(costosData)
  const ordenInfo = costosData?.orden || {}
  const lineasMaterial = costosData?.materiales?.lineas || []
  const lotesManoObra = costosData?.mano_obra?.por_lote || []

  const tabs = [
    { id: 'resumen', label: 'Comparativa & Resumen', count: null },
    { id: 'materiales', label: 'Costo de Materiales', count: lineasMaterial.length },
    { id: 'mano_obra', label: 'Costo de Mano de Obra', count: lotesManoObra.length },
    { id: 'tarifas', label: 'Tarifas por Minuto', count: rates.length },
  ]

  if (loading) {
    return (
      <div className={styles.page}>
        <div className={styles.loadingBox}>Cargando órdenes de producción...</div>
      </div>
    )
  }

  return (
    <div className={styles.page}>
      {/* Encabezado Superior */}
      <header className={styles.topHeader}>
        <div className={styles.titleArea}>
          <h1>Liquidación de Orden de Producción</h1>
          <p className={styles.subtitle}>
            Conciliación financiera de Costo de Materiales vs Costo de Mano de Obra, rendimientos y costos por lote.
          </p>
        </div>

        <div className={styles.topActions}>
          {orders.length > 0 ? (
            <>
              {/* Selector de Orden */}
              <div className={styles.orderSelectorBox}>
                <label htmlFor="orderSelect" className={styles.orderSelectorLabel}>
                  ORDEN:
                </label>
                <select
                  id="orderSelect"
                  className={styles.orderSelect}
                  value={selectedOrderId || ''}
                  onChange={handleOrderChange}
                >
                  {orders.map((ord) => (
                    <option key={ord.id} value={ord.id}>
                      {ord.codigo} — {ord.referencia_nombre} ({ord.estado_produccion_nombre || ord.estado_produccion || 'En proceso'})
                    </option>
                  ))}
                </select>
              </div>

              <button type="button" onClick={handlePrint} className={styles.btnPrint}>
                Imprimir Reporte
              </button>
            </>
          ) : (
            <div className={styles.orderSelectorBox}>
              <span className={styles.statusPill}>Sin órdenes creadas</span>
            </div>
          )}
        </div>
      </header>

      {/* Navegación por Pestañas */}
      <nav className={styles.tabNav} aria-label="Secciones de Liquidación">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            className={`${styles.tabBtn} ${activeTab === t.id ? styles.tabBtnActive : ''}`}
            onClick={() => setActiveTab(t.id)}
          >
            {t.label}
            {t.count !== null && t.count !== undefined && (
              <span className={styles.tabCountBadge}>{t.count}</span>
            )}
          </button>
        ))}
      </nav>

      {/* Pestaña de Tarifas siempre disponible */}
      {activeTab === 'tarifas' ? (
        <main className={styles.tabBody}>
          <LaborRatesTab
            rates={rates}
            onReload={() => {
              loadRates()
              if (selectedOrderId) {
                loadCostos(selectedOrderId)
              }
            }}
            notify={notify}
          />
        </main>
      ) : orders.length === 0 ? (
        <div className={styles.emptyCard}>
          <h3>No hay órdenes de producción registradas</h3>
          <p>Crea primero una orden en <strong>Órdenes de producción</strong> para poder consultar su liquidación de costos.</p>
        </div>
      ) : (
        <>
          {errorMsg && (
            <div className={styles.warningBanner}>
              <strong>Error:</strong> {errorMsg}
            </div>
          )}

          {/* Alerta de advertencias si el costeo es incompleto o la orden está anulada */}
          {costosData && !summary.completo && summary.advertencias.length > 0 && (
            <div className={styles.warningBanner}>
              <div className={styles.warningBannerTitle}>
                ⚠️ Liquidación Parcial: Se encontraron faltantes en tarifas o costos de material
              </div>
              <ul className={styles.warningList}>
                {summary.advertencias.map((adv, idx) => (
                  <li key={idx}>{adv}</li>
                ))}
              </ul>
            </div>
          )}

          {ordenInfo.anulada && (
            <div className={styles.annulledBanner}>
              🚫 Esta orden de producción fue <strong>ANULADA</strong>. Los materiales fueron devueltos al almacén y los costos se liquidan en cero.
            </div>
          )}

          {/* Tarjeta de Metadatos de la Orden */}
          <section className={styles.orderMetaCard}>
            <div className={styles.metaRow}>
              <div className={styles.metaCol}>
                <span className={styles.metaLabel}>ORDEN DE PRODUCCIÓN</span>
                <span className={styles.metaValPrimary}>{ordenInfo.codigo || '—'}</span>
              </div>
              <div className={styles.metaCol}>
                <span className={styles.metaLabel}>REFERENCIA PRENDA</span>
                <span className={styles.metaVal}>{ordenInfo.referencia_nombre || '—'}</span>
                <span className={styles.metaSubVal}>({ordenInfo.referencia_codigo || '—'})</span>
              </div>
              <div className={styles.metaCol}>
                <span className={styles.metaLabel}>PRENDAS A FABRICAR</span>
                <span className={styles.metaValHighlight}>
                  {ordenInfo.cantidad ? `${ordenInfo.cantidad} prendas` : '—'}
                </span>
              </div>
              <div className={styles.metaCol}>
                <span className={styles.metaLabel}>ESTADO DE PRODUCCIÓN</span>
                <span className={styles.statusPillMeta}>
                  {ordenInfo.estado_produccion || 'EN_PROCESO'}
                </span>
              </div>
            </div>
          </section>

          {loadingCostos ? (
            <div className={styles.loadingBox}>Calculando costos de la orden...</div>
          ) : costosData ? (
            <>
              {/* Tarjetas KPI Superiores */}
              <section className={styles.kpiGrid}>
                {/* Costo Total Liquidado */}
                <div className={styles.kpiCard}>
                  <div className={styles.kpiHead}>
                    <span className={styles.kpiLabel}>COSTO TOTAL LIQUIDADO</span>
                    <span className={`${styles.statusPill} ${summary.completo ? styles.pillSuccess : styles.pillWarning}`}>
                      {summary.completo ? 'Completo' : 'Parcial'}
                    </span>
                  </div>
                  <div className={styles.kpiValueMain}>{formatMoney(parseFloat(summary.granTotal))}</div>
                  <div className={styles.kpiFoot}>
                    Total de materiales y mano de obra devengada.
                  </div>
                </div>

                {/* Costo Unitario por Prenda */}
                <div className={styles.kpiCard}>
                  <div className={styles.kpiHead}>
                    <span className={styles.kpiLabel}>COSTO X PRENDA</span>
                    <span className={styles.kpiBadgeSub}>{ordenInfo.cantidad} prendas</span>
                  </div>
                  <div className={styles.kpiValueMain}>{formatMoney(parseFloat(summary.costoPorPrenda))}</div>
                  <div className={styles.kpiFoot}>
                    Costo real promedio por unidad fabricada.
                  </div>
                </div>

                {/* Costo de Materiales */}
                <div className={styles.kpiCard}>
                  <div className={styles.kpiHead}>
                    <span className={styles.kpiLabel}>COSTO DE MATERIALES</span>
                    <span className={styles.kpiPctBadge}>{formatPercentage(summary.materialesPct)} DEL TOTAL</span>
                  </div>
                  <div className={styles.kpiValueAccentTeal}>{formatMoney(parseFloat(summary.totalMateriales))}</div>
                  <div className={styles.kpiFoot}>
                    Telas, cierres, botones, hilos e insumos.
                  </div>
                </div>

                {/* Costo de Mano de Obra */}
                <div className={styles.kpiCard}>
                  <div className={styles.kpiHead}>
                    <span className={styles.kpiLabel}>COSTO MANO DE OBRA</span>
                    <span className={styles.kpiPctBadgeMo}>{formatPercentage(summary.manoObraPct)} DEL TOTAL</span>
                  </div>
                  <div className={styles.kpiValueAccentAmber}>{formatMoney(parseFloat(summary.totalManoObra))}</div>
                  <div className={styles.kpiFoot}>
                    Corte, confección y terminación.
                  </div>
                </div>
              </section>

              {/* Contenido de la Pestaña Activa de Orden */}
              <main className={styles.tabBody}>
                {activeTab === 'resumen' && <SettlementOverviewTab costosData={costosData} />}
                {activeTab === 'materiales' && (
                  <MaterialsCostTab
                    lineas={costosData?.materiales?.lineas || []}
                    total={costosData?.materiales?.total || '0.00'}
                  />
                )}
                {activeTab === 'mano_obra' && (
                  <LaborCostTab manoObra={costosData?.mano_obra || {}} />
                )}
              </main>
            </>
          ) : null}
        </>
      )}
    </div>
  )
}
