import React, { useState, useMemo, useEffect, useCallback } from 'react'
import { Link } from 'react-router-dom'
import {
  MOCK_PENDING_RECEPTIONS,
  MOCK_PAST_RECEPTIONS,
} from './mockLaundryData'
import {
  calculateLotReconciliation,
  calculateReceptionTotals,
  validateLotReconciliationRow,
  STANDARD_MERMA_REASONS,
  STANDARD_DAMAGE_TYPES,
  DEFAULT_GARMENT_UNIT_COST,
} from './laundryReception'
import ReceptionDocModal from './ReceptionDocModal'
import { useToast } from '../ui/toastContext'
import { apiGet, apiRequest } from '../../api/client'
import styles from './Laundry.module.css'

const formatCOP = (val) => {
  const num = Number(val) || 0
  return `$ ${num.toLocaleString('es-CO', { maximumFractionDigits: 0 })}`
}

export default function LaundryReceptionPage() {
  const notify = useToast()
  const [tab, setTab] = useState('cotejo') // 'cotejo' | 'historial'

  // Datos de API
  const [pendingRemissions, setPendingRemissions] = useState([])
  const [pastReceptions, setPastReceptions] = useState([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)

  // Remisión seleccionada para cotejo
  const [selectedRemissionId, setSelectedRemissionId] = useState('')

  // Formulario de recepción general
  const [fechaRecepcion, setFechaRecepcion] = useState(() => new Date().toISOString().slice(0, 10))
  const [facturaExterna, setFacturaExterna] = useState('')
  const [observaciones, setObservaciones] = useState('')

  // Estado del cotejo por lote: { [remision_lote_id]: { conforme, merma, danada, motivo_merma, tipo_dano, unit_cost, obs } }
  const [reconciliationData, setReconciliationData] = useState({})

  // Modal de documento generado
  const [activeDocPreview, setActiveDocPreview] = useState(null)

  // Búsqueda en historial
  const [searchQuery, setSearchQuery] = useState('')

  // Seleccionar remisión a recibir y prellenar cotejo en balance 100%
  const selectRemission = useCallback((rem) => {
    setSelectedRemissionId(rem.remision_id || rem.codigo)
    setFacturaExterna(rem.factura_remision_externa || 'FAC-LAV-' + Math.floor(1000 + Math.random() * 9000))

    const initialRecon = {}
    if (rem.lotes && rem.lotes.length > 0) {
      rem.lotes.forEach((lote) => {
        const key = lote.remision_lote_id || lote.lote_id
        initialRecon[key] = {
          remision_lote_id: lote.remision_lote_id,
          lote_id: lote.lote_id,
          codigo_lote: lote.codigo_lote,
          op_codigo: lote.op_codigo,
          referencia: lote.referencia,
          receta_nombre: lote.receta_nombre,
          tarifa_lavado: lote.tarifa_lavado || 3500,
          cantidad_enviada: lote.cantidad_enviada,
          // Por defecto arranca en balance con todo conforme
          cantidad_recibida_conforme: lote.cantidad_enviada,
          cantidad_merma: 0,
          motivo_merma: '',
          cantidad_danada: 0,
          tipo_dano: '',
          costo_unitario_prenda: lote.costo_unitario_estimado || DEFAULT_GARMENT_UNIT_COST,
          observaciones: '',
        }
      })
    }
    setReconciliationData(initialRecon)
  }, [])

  // Cargar datos iniciales
  const loadData = useCallback(async () => {
    try {
      setLoading(true)
      const [pendingRes, historyRes] = await Promise.allSettled([
        apiGet('/api/lavanderia/remisiones-pendientes/'),
        apiGet('/api/lavanderia/recepciones/'),
      ])

      const realPending =
        pendingRes.status === 'fulfilled' && Array.isArray(pendingRes.value)
          ? pendingRes.value
          : MOCK_PENDING_RECEPTIONS
      const realHistory =
        historyRes.status === 'fulfilled' && Array.isArray(historyRes.value)
          ? historyRes.value
          : MOCK_PAST_RECEPTIONS

      setPendingRemissions(realPending)
      setPastReceptions(realHistory)

      if (realPending.length > 0) {
        selectRemission(realPending[0])
      }
    } catch {
      setPendingRemissions(MOCK_PENDING_RECEPTIONS)
      setPastReceptions(MOCK_PAST_RECEPTIONS)
      if (MOCK_PENDING_RECEPTIONS.length > 0) {
        selectRemission(MOCK_PENDING_RECEPTIONS[0])
      }
    } finally {
      setLoading(false)
    }
  }, [selectRemission])

  useEffect(() => {
    loadData()
  }, [loadData])

  // Remisión activa
  const activeRemission = useMemo(() => {
    return pendingRemissions.find(
      (r) => (r.remision_id || r.codigo) === selectedRemissionId,
    )
  }, [pendingRemissions, selectedRemissionId])

  // Modificar valores de un lote
  const handleLotChange = (key, field, value) => {
    setReconciliationData((prev) => {
      const current = prev[key] || {}
      return {
        ...prev,
        [key]: {
          ...current,
          [field]: value,
        },
      }
    })
  }

  // Lista de lotes cotejados convertida a array para cálculos
  const reconLotsList = useMemo(() => {
    return Object.values(reconciliationData)
  }, [reconciliationData])

  // Totales de recepción y pérdidas financieras
  const totals = useMemo(() => {
    return calculateReceptionTotals(reconLotsList)
  }, [reconLotsList])

  // Validaciones en tiempo real
  const validationErrors = useMemo(() => {
    const errors = []
    if (!activeRemission) {
      errors.push('Selecciona una remisión despachada para cotejar.')
      return errors
    }

    if (reconLotsList.length === 0) {
      errors.push('No hay lotes en la remisión seleccionada.')
      return errors
    }

    for (const lot of reconLotsList) {
      const err = validateLotReconciliationRow(lot)
      if (err) {
        errors.push(err)
      }
    }
    return errors
  }, [activeRemission, reconLotsList])

  // Enviar y asentar recepción
  const handleSubmitReception = async (e) => {
    e.preventDefault()

    if (validationErrors.length > 0) {
      notify.error(validationErrors[0])
      return
    }

    try {
      setSubmitting(true)

      const payload = {
        remision_id: activeRemission.remision_id || activeRemission.id,
        fecha_recepcion: fechaRecepcion,
        factura_remision_externa: facturaExterna.trim(),
        observaciones: observaciones.trim(),
        lotes: reconLotsList.map((lot) => ({
          remision_lote_id: lot.remision_lote_id,
          lote_id: lot.lote_id,
          cantidad_recibida_conforme: Number(lot.cantidad_recibida_conforme) || 0,
          cantidad_merma: Number(lot.cantidad_merma) || 0,
          motivo_merma: (lot.motivo_merma || '').trim(),
          cantidad_danada: Number(lot.cantidad_danada) || 0,
          tipo_dano: (lot.tipo_dano || '').trim(),
          costo_unitario_prenda: Number(lot.costo_unitario_prenda) || DEFAULT_GARMENT_UNIT_COST,
          observaciones: (lot.observaciones || '').trim(),
        })),
      }

      const created = await apiRequest('/api/lavanderia/recepciones/', {
        method: 'POST',
        body: payload,
      })

      notify.success(
        `Recepción ${created.codigo} asentada. Se devolvieron ${created.total_recibido_conforme} prendas a planta y se asentaron ${formatCOP(created.costo_total_perdida)} en pérdidas.`,
      )

      // Abrir modal de comprobante generado
      setActiveDocPreview(created)

      // Actualizar listas locales
      setPastReceptions((prev) => [created, ...prev])
      const remainingPending = pendingRemissions.filter(
        (r) => (r.remision_id || r.id) !== payload.remision_id,
      )
      setPendingRemissions(remainingPending)
      if (remainingPending.length > 0) {
        selectRemission(remainingPending[0])
      } else {
        setSelectedRemissionId('')
        setReconciliationData({})
      }
    } catch (err) {
      const msg = err.response?.data?.message || err.message || 'Error al asentar la recepción de lavandería.'
      notify.error(msg)
    } finally {
      setSubmitting(false)
    }
  }

  // Filtrar historial
  const filteredHistory = useMemo(() => {
    if (!searchQuery.trim()) return pastReceptions
    const q = searchQuery.toLowerCase()
    return pastReceptions.filter(
      (r) =>
        r.codigo.toLowerCase().includes(q) ||
        r.remision_codigo.toLowerCase().includes(q) ||
        r.lavanderia_nombre.toLowerCase().includes(q) ||
        (r.factura_remision_externa && r.factura_remision_externa.toLowerCase().includes(q)),
    )
  }, [pastReceptions, searchQuery])

  // KPIs de historial
  const historyKPIs = useMemo(() => {
    const totalConformes = pastReceptions.reduce((acc, r) => acc + (r.total_recibido_conforme || 0), 0)
    const totalMermas = pastReceptions.reduce((acc, r) => acc + (r.total_merma || 0), 0)
    const totalDanadas = pastReceptions.reduce((acc, r) => acc + (r.total_danadas || 0), 0)
    const totalPerdidasCOP = pastReceptions.reduce((acc, r) => acc + (Number(r.costo_total_perdida) || 0), 0)
    return { totalConformes, totalMermas, totalDanadas, totalPerdidasCOP }
  }, [pastReceptions])

  return (
    <div className={styles.page}>
      {/* Encabezado */}
      <div className={styles.topHeader}>
        <div className={styles.titleArea}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
            <h1>Recepción y Cotejo de Lavandería</h1>
            <span className={`${styles.statusPill} ${styles.pillReturned}`}>
              Retorno a Planta Interna
            </span>
          </div>
          <p className={styles.subtitle}>
            Cotejo físico de prendas enviadas vs devueltas, control obligatorio de mermas y registro financiero de pérdidas por terceros.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
          <Link
            to="/lavanderia/remisiones"
            className={`${styles.btn} ${styles.btnSecondary}`}
            style={{ width: 'auto', textDecoration: 'none' }}
          >
            📋 Ir a Remisiones de Salida
          </Link>
          <button
            type="button"
            className={`${styles.btn} ${styles.btnSecondary}`}
            style={{ width: 'auto' }}
            onClick={loadData}
            title="Recargar datos de la base de datos"
          >
            🔄 Actualizar
          </button>
        </div>
      </div>

      {/* Pestañas de Navegación */}
      <div className={styles.tabsNav}>
        <button
          type="button"
          className={`${styles.tabBtn} ${tab === 'cotejo' ? styles.tabBtnActive : ''}`}
          onClick={() => setTab('cotejo')}
        >
          <span>📦 Nueva Recepción & Cotejo</span>
          <span className={styles.tabCounter}>{pendingRemissions.length}</span>
        </button>
        <button
          type="button"
          className={`${styles.tabBtn} ${tab === 'historial' ? styles.tabBtnActive : ''}`}
          onClick={() => setTab('historial')}
        >
          <span>📑 Historial de Reingresos</span>
          <span className={styles.tabCounter}>{pastReceptions.length}</span>
        </button>
      </div>

      {/* ---------------- PESTAÑA 1: NUEVA RECEPCIÓN & COTEJO ---------------- */}
      {tab === 'cotejo' && (
        <>
          {loading ? (
            <div style={{ padding: '3rem', textAlign: 'center', color: '#64748b' }}>
              <p>Cargando remisiones pendientes y catálogo de procesos...</p>
            </div>
          ) : pendingRemissions.length === 0 ? (
            <div className={styles.card} style={{ textAlign: 'center', padding: '3.5rem 1.5rem' }}>
              <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🎉</div>
              <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#0a1038', marginBottom: '0.5rem' }}>
                No hay remisiones pendientes por recibir
              </h3>
              <p style={{ color: '#64748b', maxWidth: '500px', margin: '0 auto 1.5rem auto' }}>
                Todos los lotes despachados a lavanderías externas han reingresado a la planta interna o no se han generado nuevos despachos.
              </p>
              <Link
                to="/lavanderia/remisiones"
                className={`${styles.btn} ${styles.btnPrimary}`}
                style={{ display: 'inline-block', width: 'auto', textDecoration: 'none' }}
              >
                + Crear Nueva Remisión de Salida
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmitReception}>
              {/* Paso 1: Seleccionar Remisión Despachada */}
              <div className={styles.card}>
                <div className={styles.cardHead}>
                  <div>
                    <h3 className={styles.cardTitle}>
                      <span>1.</span> Selecciona la Remisión de Salida a Cotejar
                    </h3>
                    <p className={styles.cardSubtitle}>
                      Elige el despacho original de prendas que está retornando desde el proceso externo.
                    </p>
                  </div>
                </div>

                <div className={styles.remissionPickerGrid}>
                  {pendingRemissions.map((rem) => {
                    const isSelected = (rem.remision_id || rem.codigo) === selectedRemissionId
                    return (
                      <div
                        key={rem.remision_id || rem.codigo}
                        className={`${styles.remissionSelectCard} ${
                          isSelected ? styles.remissionSelectCardActive : ''
                        }`}
                        onClick={() => selectRemission(rem)}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.4rem' }}>
                          <strong style={{ fontSize: '1.05rem', color: '#0a1038' }}>{rem.codigo}</strong>
                          <span className={`${styles.statusPill} ${styles.pillInLaundry}`}>
                            {rem.dias_en_proceso}d en lavado
                          </span>
                        </div>
                        <p style={{ fontWeight: 700, color: '#0284c7', fontSize: '0.88rem', margin: '0 0 0.25rem 0' }}>
                          {rem.lavanderia_nombre}
                        </p>
                        <div style={{ fontSize: '0.8rem', color: '#64748b', display: 'flex', justifyContent: 'space-between' }}>
                          <span>Despachado: {rem.fecha_emision}</span>
                          <span style={{ fontWeight: 800, color: '#0a1038' }}>{rem.total_prendas} prendas</span>
                        </div>
                      </div>
                    )
                  })}
                </div>

                {activeRemission && (
                  <div
                    style={{
                      background: '#f8fafc',
                      border: '1px solid #e2e8f0',
                      borderRadius: '8px',
                      padding: '0.85rem 1rem',
                      display: 'flex',
                      gap: '2rem',
                      flexWrap: 'wrap',
                      fontSize: '0.85rem',
                    }}
                  >
                    <div>
                      <span style={{ color: '#64748b', fontSize: '0.75rem', textTransform: 'uppercase', fontWeight: 700 }}>
                        Lavandería Encargada:
                      </span>
                      <p style={{ margin: 0, fontWeight: 800, color: '#0a1038' }}>
                        {activeRemission.lavanderia_nombre} ({activeRemission.lavanderia_contacto || 'Planta Externa'})
                      </p>
                    </div>
                    <div>
                      <span style={{ color: '#64748b', fontSize: '0.75rem', textTransform: 'uppercase', fontWeight: 700 }}>
                        Vehículo / Entrega:
                      </span>
                      <p style={{ margin: 0, color: '#475569' }}>
                        {activeRemission.transportador_nombre || 'Conductor asignado'} • Placa: {activeRemission.vehiculo_placa || 'N/A'}
                      </p>
                    </div>
                    <div>
                      <span style={{ color: '#64748b', fontSize: '0.75rem', textTransform: 'uppercase', fontWeight: 700 }}>
                        Fecha Estimada Retorno:
                      </span>
                      <p style={{ margin: 0, color: '#0284c7', fontWeight: 700 }}>
                        {activeRemission.fecha_entrega_estimada || 'No especificada'}
                      </p>
                    </div>
                  </div>
                )}
              </div>

              {/* Paso 2 y 3: Datos de Reingreso y Cotejo Interactivo */}
              <div className={styles.formLayout}>
                {/* Columna Izquierda: Tabla interactiva de cotejo por lote */}
                <div>
                  <div className={styles.card}>
                    <div className={styles.cardHead}>
                      <div>
                        <h3 className={styles.cardTitle}>
                          <span>2.</span> Cotejo de Cantidades: Enviadas vs Devueltas
                        </h3>
                        <p className={styles.cardSubtitle}>
                          Digita las prendas conformes recibidas, mermas por extravío y prendas con daños o defectos de lavado.
                        </p>
                      </div>
                      <span className={`${styles.balancePill} ${totals.allBalanced ? styles.balanceOk : styles.balanceDeficit}`}>
                        {totals.allBalanced ? '✓ Lotes 100% Cuadrados' : '⚠ Revisar sumas de cotejo'}
                      </span>
                    </div>

                    {reconLotsList.map((lot) => {
                      const key = lot.remision_lote_id || lot.lote_id
                      const recon = calculateLotReconciliation(
                        lot.cantidad_enviada,
                        lot.cantidad_recibida_conforme,
                        lot.cantidad_merma,
                        lot.cantidad_danada,
                      )
                      const lotLoss = (recon.merma + recon.danada) * (lot.costo_unitario_prenda || DEFAULT_GARMENT_UNIT_COST)

                      return (
                        <div key={key} className={styles.reconLotCard}>
                          {/* Encabezado del lote */}
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.5rem' }}>
                            <div>
                              <strong style={{ fontSize: '1rem', color: '#0a1038' }}>{lot.codigo_lote}</strong>
                              <span style={{ fontSize: '0.85rem', color: '#64748b', marginLeft: '0.5rem' }}>
                                OP: {lot.op_codigo} • {lot.referencia}
                              </span>
                              <div style={{ fontSize: '0.78rem', color: '#0284c7', marginTop: '0.2rem' }}>
                                Receta: <strong>{lot.receta_nombre}</strong>
                              </div>
                            </div>

                            <div style={{ textAlign: 'right' }}>
                              <span style={{ fontSize: '0.78rem', color: '#64748b', display: 'block' }}>Cant. Enviada</span>
                              <span style={{ fontSize: '1.1rem', fontWeight: 800, color: '#0a1038' }}>
                                {lot.cantidad_enviada} und
                              </span>
                            </div>
                          </div>

                          {/* Inputs de cantidades cotejadas */}
                          <div className={styles.reconInputsRow}>
                            <div>
                              <label style={{ fontSize: '0.74rem', fontWeight: 700, color: '#059669', display: 'block', marginBottom: '0.25rem' }}>
                                ✓ Conformes (1ª) *
                              </label>
                              <input
                                type="number"
                                min="0"
                                max={lot.cantidad_enviada}
                                className={styles.formInput}
                                style={{ borderColor: '#86efac', fontWeight: 800, color: '#065f46' }}
                                value={lot.cantidad_recibida_conforme}
                                onChange={(e) => handleLotChange(key, 'cantidad_recibida_conforme', e.target.value)}
                                required
                              />
                            </div>

                            <div>
                              <label style={{ fontSize: '0.74rem', fontWeight: 700, color: '#d97706', display: 'block', marginBottom: '0.25rem' }}>
                                ⚠ Merma (Extravío)
                              </label>
                              <input
                                type="number"
                                min="0"
                                max={lot.cantidad_enviada}
                                className={styles.formInput}
                                style={{ borderColor: recon.merma > 0 ? '#f59e0b' : '#cbd5e1', fontWeight: 700, color: '#92400e' }}
                                value={lot.cantidad_merma}
                                onChange={(e) => handleLotChange(key, 'cantidad_merma', e.target.value)}
                              />
                            </div>

                            <div>
                              <label style={{ fontSize: '0.74rem', fontWeight: 700, color: '#dc2626', display: 'block', marginBottom: '0.25rem' }}>
                                ✕ Dañadas (Segundas)
                              </label>
                              <input
                                type="number"
                                min="0"
                                max={lot.cantidad_enviada}
                                className={styles.formInput}
                                style={{ borderColor: recon.danada > 0 ? '#ef4444' : '#cbd5e1', fontWeight: 700, color: '#b91c1c' }}
                                value={lot.cantidad_danada}
                                onChange={(e) => handleLotChange(key, 'cantidad_danada', e.target.value)}
                              />
                            </div>

                            <div>
                              <label style={{ fontSize: '0.74rem', fontWeight: 700, color: '#64748b', display: 'block', marginBottom: '0.25rem' }}>
                                Balance Cotejo
                              </label>
                              <div style={{ paddingTop: '0.2rem' }}>
                                {recon.isBalanced ? (
                                  <span className={`${styles.balancePill} ${styles.balanceOk}`}>
                                    ✓ Cuadrado ({recon.totalReported}/{recon.enviada})
                                  </span>
                                ) : recon.hasDeficit ? (
                                  <span className={`${styles.balancePill} ${styles.balanceDeficit}`}>
                                    ⚠ Faltan {recon.diff} und
                                  </span>
                                ) : (
                                  <span className={`${styles.balancePill} ${styles.balanceSurplus}`}>
                                    ✕ Sobran {Math.abs(recon.diff)} und
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>

                          {/* Campos OBLIGATORIOS de Merma */}
                          {recon.merma > 0 && (
                            <div className={styles.mandatoryCallout}>
                              <div className={styles.mandatoryTitle}>
                                <span>⚠</span> Campo Obligatorio: Motivo de la Merma ({recon.merma} prendas extraviadas)
                              </div>
                              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginTop: '0.35rem' }}>
                                <div>
                                  <select
                                    className={styles.formSelect}
                                    value={STANDARD_MERMA_REASONS.includes(lot.motivo_merma) ? lot.motivo_merma : 'OTRO_CUSTOM'}
                                    onChange={(e) => {
                                      if (e.target.value !== 'OTRO_CUSTOM') {
                                        handleLotChange(key, 'motivo_merma', e.target.value)
                                      } else {
                                        handleLotChange(key, 'motivo_merma', '')
                                      }
                                    }}
                                  >
                                    <option value="">-- Selecciona motivo estándar --</option>
                                    {STANDARD_MERMA_REASONS.map((m) => (
                                      <option key={m} value={m}>
                                        {m}
                                      </option>
                                    ))}
                                    <option value="OTRO_CUSTOM">Otro motivo (especificar a mano)...</option>
                                  </select>
                                </div>
                                <div>
                                  <input
                                    type="text"
                                    className={styles.formInput}
                                    placeholder="Detalle específico del extravío..."
                                    value={lot.motivo_merma}
                                    onChange={(e) => handleLotChange(key, 'motivo_merma', e.target.value)}
                                    required
                                  />
                                </div>
                              </div>
                            </div>
                          )}

                          {/* Campos OBLIGATORIOS de Daño */}
                          {recon.danada > 0 && (
                            <div className={styles.mandatoryCallout} style={{ borderColor: '#fca5a5', background: '#fff5f5' }}>
                              <div className={styles.mandatoryTitle} style={{ color: '#b91c1c' }}>
                                <span>✕</span> Campo Obligatorio: Tipo de Daño / Defecto ({recon.danada} prendas defectuosas)
                              </div>
                              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginTop: '0.35rem' }}>
                                <div>
                                  <select
                                    className={styles.formSelect}
                                    value={STANDARD_DAMAGE_TYPES.includes(lot.tipo_dano) ? lot.tipo_dano : 'OTRO_CUSTOM'}
                                    onChange={(e) => {
                                      if (e.target.value !== 'OTRO_CUSTOM') {
                                        handleLotChange(key, 'tipo_dano', e.target.value)
                                      } else {
                                        handleLotChange(key, 'tipo_dano', '')
                                      }
                                    }}
                                  >
                                    <option value="">-- Selecciona tipo de daño --</option>
                                    {STANDARD_DAMAGE_TYPES.map((d) => (
                                      <option key={d} value={d}>
                                        {d}
                                      </option>
                                    ))}
                                    <option value="OTRO_CUSTOM">Otro defecto (especificar a mano)...</option>
                                  </select>
                                </div>
                                <div>
                                  <input
                                    type="text"
                                    className={styles.formInput}
                                    placeholder="Detalle técnico del defecto o quemado..."
                                    value={lot.tipo_dano}
                                    onChange={(e) => handleLotChange(key, 'tipo_dano', e.target.value)}
                                    required
                                  />
                                </div>
                              </div>
                            </div>
                          )}

                          {/* Subtotal de pérdida financiera por lote */}
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.75rem', fontSize: '0.8rem', color: '#64748b' }}>
                            <span>
                              Costo estimado prenda: <strong>{formatCOP(lot.costo_unitario_prenda || DEFAULT_GARMENT_UNIT_COST)}</strong>
                            </span>
                            <span style={{ fontWeight: 700, color: lotLoss > 0 ? '#b91c1c' : '#059669' }}>
                              Pérdida por defectos/mermas en este lote: {formatCOP(lotLoss)}
                            </span>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>

                {/* Columna Derecha: Datos generales y Liquidación Financiera */}
                <div>
                  {/* Tarjeta de Documento de Reingreso */}
                  <div className={styles.card}>
                    <h3 className={styles.cardTitle} style={{ fontSize: '1.05rem', marginBottom: '1rem' }}>
                      Datos del Documento de Reingreso
                    </h3>

                    <div className={styles.formGroup}>
                      <label className={styles.formLabel}>
                        Factura / Remisión Externa del Proveedor
                      </label>
                      <input
                        type="text"
                        className={styles.formInput}
                        placeholder="Ej: FAC-LAV-8841 o GUIA-9021"
                        value={facturaExterna}
                        onChange={(e) => setFacturaExterna(e.target.value)}
                        required
                      />
                      <span style={{ fontSize: '0.74rem', color: '#64748b', marginTop: '0.2rem', display: 'block' }}>
                        Número del comprobante físico entregado por la lavandería.
                      </span>
                    </div>

                    <div className={styles.formGroup}>
                      <label className={styles.formLabel}>Fecha de Recepción en Planta</label>
                      <input
                        type="date"
                        className={styles.formInput}
                        value={fechaRecepcion}
                        onChange={(e) => setFechaRecepcion(e.target.value)}
                        required
                      />
                    </div>

                    <div className={styles.formGroup}>
                      <label className={styles.formLabel}>Observaciones de Recepción</label>
                      <textarea
                        className={styles.formTextarea}
                        rows={2}
                        placeholder="Observaciones de conteo, estado de tulas o novedades..."
                        value={observaciones}
                        onChange={(e) => setObservaciones(e.target.value)}
                      />
                    </div>
                  </div>

                  {/* Tarjeta de Liquidación Financiera por Terceros */}
                  <div className={styles.card}>
                    <h3 className={styles.cardTitle} style={{ fontSize: '1.05rem', marginBottom: '0.75rem', color: '#0a1038' }}>
                      Liquidación Financiera por Terceros
                    </h3>
                    <p style={{ fontSize: '0.8rem', color: '#64748b', marginBottom: '1rem' }}>
                      Cálculo de pérdidas por mermas y prendas dañadas a deducir o asentar contablemente.
                    </p>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '1rem' }}>
                      <div className={styles.kpiCard}>
                        <span className={styles.kpiCardTitle}>Conformes</span>
                        <span className={styles.kpiCardValue} style={{ color: '#059669' }}>
                          {totals.totalConforme} <span style={{ fontSize: '0.85rem' }}>und</span>
                        </span>
                      </div>
                      <div className={styles.kpiCard}>
                        <span className={styles.kpiCardTitle}>Afectadas</span>
                        <span className={styles.kpiCardValue} style={{ color: totals.totalMerma + totals.totalDanada > 0 ? '#dc2626' : '#64748b' }}>
                          {totals.totalMerma + totals.totalDanada} <span style={{ fontSize: '0.85rem' }}>und</span>
                        </span>
                      </div>
                    </div>

                    {/* Pérdida Financiera Destacada */}
                    <div className={styles.financialLossSummary}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: '0.78rem', textTransform: 'uppercase', fontWeight: 800, color: '#991b1b' }}>
                          Pérdida Financiera Liquidada:
                        </span>
                        <span className={styles.financialLossNumber}>
                          {formatCOP(totals.totalPerdidaFinanciera)}
                        </span>
                      </div>
                      <p style={{ margin: '0.35rem 0 0 0', fontSize: '0.75rem', color: '#7f1d1d' }}>
                        {totals.totalMerma} prendas extraviadas + {totals.totalDanada} prendas con defectos de lavandería.
                      </p>
                    </div>

                    {/* Cobro de Servicio Estimado */}
                    <div style={{ marginTop: '0.85rem', padding: '0.75rem', background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '0.85rem' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ color: '#475569' }}>Servicio de lavado a liquidar:</span>
                        <strong style={{ color: '#0284c7' }}>{formatCOP(totals.totalServicioLavado)}</strong>
                      </div>
                      <span style={{ fontSize: '0.74rem', color: '#64748b', display: 'block', marginTop: '0.2rem' }}>
                        Calculado sobre {totals.totalConforme} prendas procesadas y aprobadas.
                      </span>
                    </div>

                    {/* Alertas de Validación */}
                    {validationErrors.length > 0 && (
                      <div style={{ marginTop: '1rem', padding: '0.75rem', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '6px', fontSize: '0.8rem', color: '#991b1b' }}>
                        <strong>⚠ No se puede asentar aún:</strong>
                        <ul style={{ margin: '0.35rem 0 0 1.25rem', padding: 0 }}>
                          {validationErrors.slice(0, 3).map((err, idx) => (
                            <li key={idx}>{err}</li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {/* Botón de Asentamiento */}
                    <button
                      type="submit"
                      disabled={submitting || validationErrors.length > 0}
                      className={`${styles.btn} ${styles.btnPrimary}`}
                      style={{ marginTop: '1.25rem', padding: '0.9rem' }}
                    >
                      {submitting ? 'Asentando Reingreso...' : '📥 Asentar Reingreso a Planta & Liquidar'}
                    </button>
                  </div>
                </div>
              </div>
            </form>
          )}
        </>
      )}

      {/* ---------------- PESTAÑA 2: HISTORIAL DE RECEPCIONES ---------------- */}
      {tab === 'historial' && (
        <div className={styles.card}>
          <div className={styles.cardHead}>
            <div>
              <h3 className={styles.cardTitle}>Historial de Actas de Recepción y Pérdidas de Lavandería</h3>
              <p className={styles.cardSubtitle}>
                Registros oficiales de reingreso a planta interna, cotejo de cantidades y pérdidas financieras por terceros.
              </p>
            </div>
            <div style={{ minWidth: '260px' }}>
              <input
                type="text"
                className={styles.formInput}
                placeholder="Buscar por código, remisión o lavandería..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </div>

          {/* Resumen KPIs del Historial */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
            <div className={styles.kpiCard}>
              <span className={styles.kpiCardTitle}>Actas Asentadas</span>
              <span className={styles.kpiCardValue}>{pastReceptions.length}</span>
            </div>
            <div className={styles.kpiCard}>
              <span className={styles.kpiCardTitle}>Prendas Retornadas (Conformes)</span>
              <span className={styles.kpiCardValue} style={{ color: '#059669' }}>
                {historyKPIs.totalConformes} <span style={{ fontSize: '0.85rem' }}>und</span>
              </span>
            </div>
            <div className={styles.kpiCard}>
              <span className={styles.kpiCardTitle}>Mermas & Daños Acumulados</span>
              <span className={styles.kpiCardValue} style={{ color: '#dc2626' }}>
                {historyKPIs.totalMermas + historyKPIs.totalDanadas} <span style={{ fontSize: '0.85rem' }}>und</span>
              </span>
            </div>
            <div className={styles.kpiCard}>
              <span className={styles.kpiCardTitle}>Pérdidas Totales Liquidadas</span>
              <span className={styles.kpiCardValue} style={{ color: '#b91c1c' }}>
                {formatCOP(historyKPIs.totalPerdidasCOP)}
              </span>
            </div>
          </div>

          {/* Tabla de Actas */}
          {filteredHistory.length === 0 ? (
            <div style={{ padding: '2rem', textAlign: 'center', color: '#64748b' }}>
              No se encontraron registros de recepción con los filtros aplicados.
            </div>
          ) : (
            <div className={styles.tableContainer}>
              <table className={styles.dataTable}>
                <thead>
                  <tr>
                    <th>Acta Recepción</th>
                    <th>Remisión Salida Original</th>
                    <th>Lavandería Externa</th>
                    <th>Fecha</th>
                    <th className={styles.numeric}>Conformes</th>
                    <th className={styles.numeric}>Mermas</th>
                    <th className={styles.numeric}>Daños</th>
                    <th className={styles.numeric}>Pérdida Financiera</th>
                    <th style={{ textAlign: 'center' }}>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredHistory.map((rec) => (
                    <tr key={rec.id || rec.codigo}>
                      <td>
                        <strong style={{ color: '#0a1038' }}>{rec.codigo}</strong>
                        {rec.factura_remision_externa && (
                          <span style={{ display: 'block', fontSize: '0.74rem', color: '#64748b' }}>
                            Doc. Ext: {rec.factura_remision_externa}
                          </span>
                        )}
                      </td>
                      <td>
                        <strong>{rec.remision_codigo}</strong>
                      </td>
                      <td>
                        <strong>{rec.lavanderia_nombre}</strong>
                      </td>
                      <td>{rec.fecha_recepcion}</td>
                      <td className={styles.numeric} style={{ fontWeight: 800, color: '#059669' }}>
                        {rec.total_recibido_conforme} und
                      </td>
                      <td className={styles.numeric} style={{ fontWeight: 700, color: rec.total_merma > 0 ? '#d97706' : '#94a3b8' }}>
                        {rec.total_merma} und
                      </td>
                      <td className={styles.numeric} style={{ fontWeight: 700, color: rec.total_danadas > 0 ? '#dc2626' : '#94a3b8' }}>
                        {rec.total_danadas} und
                      </td>
                      <td className={styles.numeric} style={{ fontWeight: 800, color: rec.costo_total_perdida > 0 ? '#b91c1c' : '#475569' }}>
                        {formatCOP(rec.costo_total_perdida)}
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <button
                          type="button"
                          className={`${styles.btn} ${styles.btnSecondary}`}
                          style={{ width: 'auto', padding: '0.35rem 0.75rem', fontSize: '0.8rem' }}
                          onClick={() => setActiveDocPreview(rec)}
                        >
                          👁️ Ver Acta Oficial
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Modal de Comprobante / Acta Oficial de Recepción */}
      {activeDocPreview && (
        <ReceptionDocModal
          reception={activeDocPreview}
          onClose={() => setActiveDocPreview(null)}
          onPrint={() => window.print()}
        />
      )}
    </div>
  )
}
