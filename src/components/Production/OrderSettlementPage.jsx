import React, { useState, useEffect } from 'react'
import { MOCK_ORDERS_SETTLEMENT } from './mockSettlementData'
import SettlementOverviewTab from './SettlementOverviewTab'
import MaterialsCostTab from './MaterialsCostTab'
import LaborCostTab from './LaborCostTab'
import CostSimulatorTab from './CostSimulatorTab'
import SettlementApprovalModal from './SettlementApprovalModal'
import { useToast } from '../ui/toastContext'
import styles from './Production.module.css'

const formatCOP = (val) => {
  const num = Number(val) || 0
  return `$ ${num.toLocaleString('es-CO', { maximumFractionDigits: 0 })}`
}

const formatPct = (val) => {
  const num = Number(val) || 0
  return `${num.toLocaleString('es-CO', { minimumFractionDigits: 1, maximumFractionDigits: 2 })}%`
}

export default function OrderSettlementPage() {
  const notify = useToast()
  const [orders, setOrders] = useState(MOCK_ORDERS_SETTLEMENT)
  const [currentOrderId, setCurrentOrderId] = useState(MOCK_ORDERS_SETTLEMENT[0].id)
  const [activeTab, setActiveTab] = useState('resumen')
  const [isApprovalOpen, setIsApprovalOpen] = useState(false)

  // Orden activa actualmente seleccionada
  const currentOrder = orders.find((o) => o.id === currentOrderId) || orders[0]

  // Intentar cargar órdenes adicionales del backend si está disponible
  useEffect(() => {
    // Si la API responde órdenes de producción, las dejamos disponibles en la vista
    fetch('/api/inventario/ordenes/')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (Array.isArray(data) && data.length > 0) {
          // Si hay órdenes reales, podemos enriquecer la lista
        }
      })
      .catch(() => {
        // En modo offline o solo frontend, usamos el dataset de demostración
      })
  }, [])

  const handlePrint = () => {
    window.print()
  }

  const handleApproveConfirm = ({ approverName, auditNotes }) => {
    setOrders((prev) =>
      prev.map((ord) => {
        if (ord.id === currentOrder.id) {
          return {
            ...ord,
            estado: 'APROBADA',
            liquidador: approverName,
            auditNotes,
          }
        }
        return ord
      })
    )
    setIsApprovalOpen(false)
    if (notify) {
      notify(`Orden ${currentOrder.codigo} aprobada exitosamente por ${approverName}.`, 'success')
    }
  }

  const { resumen } = currentOrder
  const { materiales, mano_obra, totales } = resumen

  const tabs = [
    { id: 'resumen', label: 'Comparativa & Resumen', count: null },
    { id: 'materiales', label: 'Costo de Materiales', count: currentOrder.materiales_detalle.length },
    { id: 'mano_obra', label: 'Costo de Mano de Obra', count: currentOrder.mano_obra_detalle.length },
    { id: 'simulador', label: 'Simulador Rentabilidad', count: 'What-If' },
  ]

  return (
    <div className={styles.page}>
      {/* Encabezado Superior */}
      <header className={styles.topHeader}>
        <div className={styles.titleArea}>
          <div className={styles.ticketBadge}>
            TE-56 / TE-127 • <span>Liquidación de Órdenes</span>
          </div>
          <h1>Liquidación de Orden de Producción</h1>
          <p className={styles.subtitle}>
            Conciliación financiera de Costo de Materiales vs Costo de Mano de Obra, rendimientos y rentabilidad del lote.
          </p>
        </div>

        <div className={styles.topActions}>
          {/* Selector de Orden */}
          <div className={styles.orderSelectorBox}>
            <label htmlFor="orderSelect" className={styles.orderSelectorLabel}>
              Orden:
            </label>
            <select
              id="orderSelect"
              className={styles.orderSelect}
              value={currentOrderId}
              onChange={(e) => setCurrentOrderId(e.target.value)}
            >
              {orders.map((ord) => (
                <option key={ord.id} value={ord.id}>
                  {ord.codigo} — {ord.referencia} ({ord.estado})
                </option>
              ))}
            </select>
          </div>

          <button
            type="button"
            className={`${styles.btn} ${styles.btnSecondary}`}
            onClick={handlePrint}
            title="Imprimir o exportar en PDF"
          >
            Imprimir Reporte
          </button>

          {currentOrder.estado !== 'APROBADA' && currentOrder.estado !== 'CERRADA' ? (
            <button
              type="button"
              className={`${styles.btn} ${styles.btnPrimary}`}
              onClick={() => setIsApprovalOpen(true)}
            >
              Aprobar Liquidación
            </button>
          ) : (
            <span className={`${styles.statusPill} ${styles.pillSuccess}`} style={{ padding: '0.45rem 0.85rem' }}>
              Liquidación Aprobada
            </span>
          )}
        </div>
      </header>

      {/* Tarjeta de Metadatos de la Orden */}
      <section className={styles.orderMetaCard} aria-label="Información de la Orden">
        <div className={styles.metaItem}>
          <span className={styles.metaLabel}>Orden de Producción</span>
          <span className={`${styles.metaValue} ${styles.metaValueHighlight}`}>{currentOrder.codigo}</span>
        </div>

        <div className={styles.metaItem}>
          <span className={styles.metaLabel}>Referencia Prenda</span>
          <span className={styles.metaValue}>{currentOrder.referencia}</span>
        </div>

        <div className={styles.metaItem}>
          <span className={styles.metaLabel}>Ficha Técnica</span>
          <span className={styles.metaValue}>{currentOrder.ficha_tecnica}</span>
        </div>

        <div className={styles.metaItem}>
          <span className={styles.metaLabel}>Lote / Cliente</span>
          <span className={styles.metaValue}>
            {currentOrder.lote} • {currentOrder.cliente}
          </span>
        </div>

        <div className={styles.metaItem}>
          <span className={styles.metaLabel}>Prendas (Prog / 1ra / Mermas)</span>
          <span className={styles.metaValue}>
            {currentOrder.unidades_programadas} prog. / <strong style={{ color: '#2bd6c0' }}>{currentOrder.unidades_primera}</strong> 1ra / {currentOrder.unidades_segunda} seg.
          </span>
        </div>

        <div className={styles.metaItem}>
          <span className={styles.metaLabel}>Fechas (Corte / Cierre)</span>
          <span className={styles.metaValue}>
            {currentOrder.fecha_corte} a {currentOrder.fecha_liquidacion}
          </span>
        </div>

        <div className={styles.metaItem}>
          <span className={styles.metaLabel}>Responsable & Auditor</span>
          <span className={styles.metaValue}>
            {currentOrder.responsable} • {currentOrder.liquidador}
          </span>
        </div>

        <div className={styles.metaItem}>
          <span className={styles.metaLabel}>Estado Liquidación</span>
          <span className={styles.metaValue}>
            <span
              className={`${styles.statusPill} ${
                currentOrder.estado === 'APROBADA'
                  ? styles.pillSuccess
                  : currentOrder.estado === 'LIQUIDADA'
                  ? styles.pillWarning
                  : styles.pillNeutral
              }`}
            >
              {currentOrder.estado}
            </span>
          </span>
        </div>
      </section>

      {/* KPIs Financieros Principales */}
      <section className={styles.kpiGrid} aria-label="Indicadores Financieros">
        {/* KPI 1: Costo Total */}
        <div className={`${styles.kpiCard} ${styles.kpiCardAccentTotal}`}>
          <div className={styles.kpiHead}>
            <span className={styles.kpiLabel}>Costo Total Liquidado</span>
            <span
              className={`${styles.kpiBadge} ${
                totales.variacion > 0 ? styles.pillWarning : styles.pillSuccess
              }`}
            >
              {totales.variacion > 0 ? '+' : ''}{formatPct(totales.variacion_pct)}
            </span>
          </div>
          <div className={styles.kpiAmount}>{formatCOP(totales.real)}</div>
          <div className={styles.kpiFooter}>
            <span>Presupuestado:</span>
            <strong>{formatCOP(totales.presupuestado)}</strong>
          </div>
        </div>

        {/* KPI 2: Costo Unitario por Prenda */}
        <div className={`${styles.kpiCard} ${styles.kpiCardAccentTotal}`}>
          <div className={styles.kpiHead}>
            <span className={styles.kpiLabel}>Costo Unitario x Prenda</span>
            <span className={`${styles.statusPill} ${styles.pillNeutral}`}>
              {currentOrder.unidades_primera} prendas
            </span>
          </div>
          <div className={styles.kpiAmount}>{formatCOP(totales.costo_unitario_real)}</div>
          <div className={styles.kpiFooter}>
            <span>Costo estándar:</span>
            <strong>{formatCOP(totales.costo_unitario_presupuestado)} / und</strong>
          </div>
        </div>

        {/* KPI 3: Costo de Materiales */}
        <div className={`${styles.kpiCard} ${styles.kpiCardAccentMat}`}>
          <div className={styles.kpiHead}>
            <span className={styles.kpiLabel}>Costo de Materiales</span>
            <span className={`${styles.statusPill} ${styles.pillSuccess}`}>
              {formatPct(materiales.porcentaje_costo)} del total
            </span>
          </div>
          <div className={styles.kpiAmount} style={{ color: '#0f766e' }}>
            {formatCOP(materiales.real)}
          </div>
          <div className={styles.kpiFooter}>
            <span>Unitario tela e insumos:</span>
            <strong>{formatCOP(materiales.unitario_real)} / und</strong>
          </div>
        </div>

        {/* KPI 4: Costo de Mano de Obra */}
        <div className={`${styles.kpiCard} ${styles.kpiCardAccentMo}`}>
          <div className={styles.kpiHead}>
            <span className={styles.kpiLabel}>Costo Mano de Obra</span>
            <span className={`${styles.statusPill} ${styles.pillWarning}`}>
              {formatPct(mano_obra.porcentaje_costo)} del total
            </span>
          </div>
          <div className={styles.kpiAmount} style={{ color: '#d97706' }}>
            {formatCOP(mano_obra.real)}
          </div>
          <div className={styles.kpiFooter}>
            <span>Unitario confección/maquila:</span>
            <strong>{formatCOP(mano_obra.unitario_real)} / und</strong>
          </div>
        </div>

        {/* KPI 5: Margen Bruto */}
        <div className={`${styles.kpiCard} ${styles.kpiCardAccentMargen}`}>
          <div className={styles.kpiHead}>
            <span className={styles.kpiLabel}>Margen Bruto</span>
            <span className={`${styles.statusPill} ${styles.pillSuccess}`}>
              PV: {formatCOP(currentOrder.precio_venta_unitario)}
            </span>
          </div>
          <div className={styles.kpiAmount} style={{ color: '#059669' }}>
            {formatPct(totales.margen_bruto_pct)}
          </div>
          <div className={styles.kpiFooter}>
            <span>Utilidad bruta:</span>
            <strong>{formatCOP(totales.utilidad_bruta_unitaria)} / und</strong>
          </div>
        </div>
      </section>

      {/* Barra de Pestañas */}
      <nav className={styles.tabsNav} role="tablist" aria-label="Secciones de liquidación">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={activeTab === tab.id}
            className={`${styles.tabBtn} ${activeTab === tab.id ? styles.tabBtnActive : ''}`}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.label}
            {tab.count !== null && <span className={styles.tabCounter}>{tab.count}</span>}
          </button>
        ))}
      </nav>

      {/* Contenido de la Pestaña Activa */}
      {activeTab === 'resumen' && <SettlementOverviewTab order={currentOrder} />}
      {activeTab === 'materiales' && <MaterialsCostTab order={currentOrder} />}
      {activeTab === 'mano_obra' && <LaborCostTab order={currentOrder} />}
      {activeTab === 'simulador' && <CostSimulatorTab order={currentOrder} />}

      {/* Modal de Aprobación */}
      {isApprovalOpen && (
        <SettlementApprovalModal
          order={currentOrder}
          onClose={() => setIsApprovalOpen(false)}
          onConfirm={handleApproveConfirm}
        />
      )}
    </div>
  )
}
