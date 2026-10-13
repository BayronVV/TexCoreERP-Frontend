import React, { useState, useMemo } from 'react'
import {
  MOCK_AVAILABLE_LOTS,
  MOCK_LAUNDRY_PROVIDERS,
  MOCK_WASH_RECIPES,
  MOCK_PAST_REMISSIONS,
} from './mockLaundryData'
import RemissionDocModal from './RemissionDocModal'
import { useToast } from '../ui/toastContext'
import styles from './Laundry.module.css'

const formatCOP = (val) => {
  const num = Number(val) || 0
  return `$ ${num.toLocaleString('es-CO', { maximumFractionDigits: 0 })}`
}

export default function LaundryRemissionPage() {
  const notify = useToast()
  const [tab, setTab] = useState('nueva')
  const [remissionsList, setRemissionsList] = useState(MOCK_PAST_REMISSIONS)

  // Estado del formulario de remisión
  const [selectedLots, setSelectedLots] = useState({
    'LOT-2026-044': {
      selected: true,
      qty: 500,
      receta_id: 'REC-SW-01',
      instrucciones: 'Conservar muestra física de tono entregada #2. Cuidado con remaches de relojera.',
    },
    'LOT-2026-045': {
      selected: false,
      qty: 350,
      receta_id: 'REC-BK-04',
      instrucciones: 'Prenda con bolsillos cargo; fijar colorante reactivo para evitar desteñido.',
    },
    'LOT-2026-046': {
      selected: false,
      qty: 420,
      receta_id: 'REC-BL-02',
      instrucciones: 'Desgaste focalizado láser en muslos delanteros.',
    },
    'LOT-2026-047': {
      selected: false,
      qty: 600,
      receta_id: 'REC-DS-03',
      instrucciones: 'Ruedo deshilachado con protección.',
    },
  })

  // Datos generales del despacho
  const [selectedProviderId, setSelectedProviderId] = useState('prov-1')
  const [fechaEmision, setFechaEmision] = useState(() => new Date().toISOString().slice(0, 10))
  const [fechaEntrega, setFechaEntrega] = useState(() => {
    const d = new Date()
    d.setDate(d.getDate() + 3)
    return d.toISOString().slice(0, 10)
  })
  const [transportador, setTransportador] = useState('Carlos Mario Pineda (Conductor TexCore)')
  const [placaVehiculo, setPlacaVehiculo] = useState('WXY-789')
  const [tulasBultos, setTulasBultos] = useState('10')
  const [pesoKg, setPesoKg] = useState('320')
  const [observaciones, setObservaciones] = useState('Lotes ensamblados entregados en tulas numeradas de 50 prendas.')

  // Modal de documento generado
  const [activePreviewDoc, setActivePreviewDoc] = useState(null)

  const activeProvider = useMemo(
    () => MOCK_LAUNDRY_PROVIDERS.find((p) => p.id === selectedProviderId) || MOCK_LAUNDRY_PROVIDERS[0],
    [selectedProviderId]
  )

  // Manejo de selección de lote
  const handleToggleLot = (lotId, defaultQty, defaultReceta) => {
    setSelectedLots((prev) => {
      const current = prev[lotId] || { selected: false, qty: defaultQty, receta_id: defaultReceta, instrucciones: '' }
      return {
        ...prev,
        [lotId]: {
          ...current,
          selected: !current.selected,
          qty: current.qty || defaultQty,
          receta_id: current.receta_id || defaultReceta,
        },
      }
    })
  }

  const handleUpdateQty = (lotId, maxQty, value) => {
    const parsed = parseInt(value, 10)
    const validQty = isNaN(parsed) ? 0 : Math.max(0, Math.min(parsed, maxQty))
    setSelectedLots((prev) => ({
      ...prev,
      [lotId]: {
        ...prev[lotId],
        qty: validQty,
      },
    }))
  }

  const handleUpdateLotReceta = (lotId, recetaId) => {
    setSelectedLots((prev) => ({
      ...prev,
      [lotId]: {
        ...prev[lotId],
        receta_id: recetaId,
      },
    }))
  }

  const handleUpdateLotInstructions = (lotId, text) => {
    setSelectedLots((prev) => ({
      ...prev,
      [lotId]: {
        ...prev[lotId],
        instrucciones: text,
      },
    }))
  }

  // Lotes que actualmente están seleccionados
  const chosenLotsData = useMemo(() => {
    return MOCK_AVAILABLE_LOTS.filter((lot) => selectedLots[lot.id]?.selected && selectedLots[lot.id]?.qty > 0).map(
      (lot) => {
        const lotState = selectedLots[lot.id]
        const recetaObj = MOCK_WASH_RECIPES.find((r) => r.id === lotState.receta_id)
        return {
          ...lot,
          cantidad_a_enviar: lotState.qty,
          receta_id: lotState.receta_id,
          receta_nombre: recetaObj?.nombre || 'Proceso estándar',
          instrucciones_especiales: lotState.instrucciones,
        }
      }
    )
  }, [selectedLots])

  const totalPrendas = useMemo(() => {
    return chosenLotsData.reduce((acc, lot) => acc + lot.cantidad_a_enviar, 0)
  }, [chosenLotsData])

  const costoEstimadoTotal = useMemo(() => {
    return totalPrendas * activeProvider.tarifa_base_unidad
  }, [totalPrendas, activeProvider])

  // Despacho de la remisión
  const handleGenerateRemission = (e) => {
    e.preventDefault()
    if (chosenLotsData.length === 0 || totalPrendas === 0) {
      if (notify) notify('Debes seleccionar al menos un lote ensamblado con cantidad mayor a 0.', 'error')
      return
    }

    const consecutivo = `REM-LAV-2026-004${remissionsList.length + 1}`

    const newRemission = {
      id: `rem-${Date.now()}`,
      codigo: consecutivo,
      fecha_emision: fechaEmision,
      fecha_entrega_estimada: fechaEntrega,
      lavanderia_id: activeProvider.id,
      lavanderia_nombre: activeProvider.razon_social,
      contacto_lavanderia: activeProvider.contacto,
      lotes_nombres: chosenLotsData.map((l) => `${l.codigo_lote} (${l.referencia})`),
      lotes_detalle: chosenLotsData,
      total_lotes: chosenLotsData.length,
      total_prendas: totalPrendas,
      receta_nombre: chosenLotsData[0]?.receta_nombre || 'Lavado Industrial',
      costo_estimado: costoEstimadoTotal,
      transportador_nombre: transportador,
      vehiculo_placa: placaVehiculo,
      tulas_bultos: tulasBultos || 1,
      peso_kg: pesoKg || 0,
      estado: 'EN_LAVANDERIA',
      responsable_despacho: 'Carlos E. Restrepo (Jefe de Producción)',
      observaciones,
    }

    setRemissionsList([newRemission, ...remissionsList])
    setActivePreviewDoc(newRemission)

    if (notify) {
      notify(`Remisión ${consecutivo} generada con éxito (${totalPrendas} prendas enviadas a ${activeProvider.razon_social}).`, 'success')
    }
  }

  const handleClear = () => {
    setSelectedLots({})
  }

  return (
    <div className={styles.page}>
      {/* Encabezado Superior */}
      <header className={styles.topHeader}>
        <div className={styles.titleArea}>
          <div className={styles.ticketBadge}>
            TE-57 / TE-131 • <span>Procesos Externos (Lavandería)</span>
          </div>
          <h1>Remisión de Lotes Ensamblados a Lavado</h1>
          <p className={styles.subtitle}>
            Generación de guías de despacho seleccionando los lotes de jeans ensamblados en planta para envío a lavanderías industriales.
          </p>
        </div>
      </header>

      {/* Navegación de Pestañas */}
      <nav className={styles.tabsNav} role="tablist" aria-label="Secciones de remisión">
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'nueva'}
          className={`${styles.tabBtn} ${tab === 'nueva' ? styles.tabBtnActive : ''}`}
          onClick={() => setTab('nueva')}
        >
          Nueva Remisión
          <span className={styles.tabCounter}>{MOCK_AVAILABLE_LOTS.length} lotes listos</span>
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'historial'}
          className={`${styles.tabBtn} ${tab === 'historial' ? styles.tabBtnActive : ''}`}
          onClick={() => setTab('historial')}
        >
          Historial de Remisiones
          <span className={styles.tabCounter}>{remissionsList.length}</span>
        </button>
      </nav>

      {/* PESTAÑA 1: NUEVA REMISIÓN */}
      {tab === 'nueva' && (
        <form onSubmit={handleGenerateRemission} className={styles.formLayout}>
          {/* Columna Izquierda: Selección de Lotes y Datos del Envío */}
          <div>
            {/* SECCIÓN 1: SELECCIÓN DE LOTES ENSAMBLADOS */}
            <section className={styles.card}>
              <div className={styles.cardHead}>
                <div>
                  <h2 className={styles.cardTitle}>
                    1. Seleccionar Lotes Ensamblados a Lavar
                  </h2>
                  <p className={styles.cardSubtitle}>
                    Elige los lotes de jeans terminados en confección que serán despachados a la lavandería externa.
                  </p>
                </div>
                <span className={`${styles.statusPill} ${styles.pillInLaundry}`}>
                  {chosenLotsData.length} seleccionado(s)
                </span>
              </div>

              <div className={styles.lotsGrid}>
                {MOCK_AVAILABLE_LOTS.map((lot) => {
                  const lotState = selectedLots[lot.id] || {
                    selected: false,
                    qty: lot.unidades_disponibles,
                    receta_id: lot.receta_sugerida,
                    instrucciones: '',
                  }
                  const isSelected = lotState.selected

                  return (
                    <article
                      key={lot.id}
                      className={`${styles.lotCard} ${isSelected ? styles.lotCardSelected : ''}`}
                      onClick={() => handleToggleLot(lot.id, lot.unidades_disponibles, lot.receta_sugerida)}
                    >
                      <div className={styles.lotCardHeader}>
                        <div className={styles.lotTitleGroup}>
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => {}} // Manejado por onClick del contenedor
                            className={styles.checkboxInput}
                            id={`check-${lot.id}`}
                            aria-label={`Seleccionar ${lot.codigo_lote}`}
                          />
                          <div>
                            <div className={styles.lotCode}>
                              {lot.codigo_lote} <span style={{ color: '#0284c7', fontSize: '0.9rem' }}>({lot.op_codigo})</span>
                            </div>
                            <div className={styles.lotRef}>{lot.referencia}</div>
                          </div>
                        </div>

                        <div style={{ textAlign: 'right' }}>
                          <span className={`${styles.statusPill} ${styles.pillReturned}`}>
                            {lot.unidades_disponibles} prendas ensambladas
                          </span>
                        </div>
                      </div>

                      <div className={styles.lotMetaRow}>
                        <span>Ficha Técnica: <strong>{lot.ficha_tecnica}</strong></span>
                        <span>Tela: <strong>{lot.tela}</strong></span>
                        <span>Color Crudo: <strong>{lot.color_crudo}</strong></span>
                        <span>Ensamble: <strong>{lot.taller_confeccion}</strong></span>
                      </div>

                      {/* Curva de Tallas */}
                      <div className={styles.sizeCurveBox} onClick={(e) => e.stopPropagation()}>
                        <span className={styles.sizeCurveLabel}>Curva de tallas:</span>
                        <div className={styles.sizePills}>
                          {Object.entries(lot.curva_tallas).map(([talla, cant]) => (
                            <span key={talla} className={styles.sizePill}>
                              Talla {talla}: <span>{cant}</span>
                            </span>
                          ))}
                        </div>
                      </div>

                      {/* Controles activos cuando el lote está seleccionado */}
                      {isSelected && (
                        <div className={styles.lotSendControls} onClick={(e) => e.stopPropagation()}>
                          <div className={styles.sendInputGroup}>
                            <label htmlFor={`qty-${lot.id}`}>Prendas a Enviar:</label>
                            <input
                              id={`qty-${lot.id}`}
                              type="number"
                              min="1"
                              max={lot.unidades_disponibles}
                              value={lotState.qty}
                              onChange={(e) => handleUpdateQty(lot.id, lot.unidades_disponibles, e.target.value)}
                              className={styles.sendQtyInput}
                            />
                            <span style={{ fontSize: '0.8rem', color: '#475569' }}>
                              de {lot.unidades_disponibles} und
                            </span>
                          </div>

                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flex: 1, minWidth: '220px' }}>
                            <label style={{ fontSize: '0.8rem', fontWeight: 700, color: '#0369a1', whiteSpace: 'nowrap' }}>
                              Proceso de Lavado:
                            </label>
                            <select
                              value={lotState.receta_id || lot.receta_sugerida}
                              onChange={(e) => handleUpdateLotReceta(lot.id, e.target.value)}
                              style={{ padding: '0.35rem 0.6rem', borderRadius: '6px', border: '1.5px solid #0284c7', fontSize: '0.85rem', width: '100%', background: 'white' }}
                            >
                              {MOCK_WASH_RECIPES.map((recipe) => (
                                <option key={recipe.id} value={recipe.id}>
                                  {recipe.nombre} ({formatCOP(recipe.tarifa_sugerida)}/und)
                                </option>
                              ))}
                            </select>
                          </div>

                          <div style={{ width: '100%', marginTop: '0.4rem' }}>
                            <input
                              type="text"
                              placeholder="Instrucciones especiales para la lavandería en este lote (opcional)..."
                              value={lotState.instrucciones || ''}
                              onChange={(e) => handleUpdateLotInstructions(lot.id, e.target.value)}
                              style={{ width: '100%', padding: '0.4rem 0.65rem', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '0.82rem', background: 'white' }}
                            />
                          </div>
                        </div>
                      )}
                    </article>
                  )
                })}
              </div>
            </section>

            {/* SECCIÓN 2: PROVEEDOR DE LAVANDERÍA Y TRANSPORTE */}
            <section className={styles.card}>
              <div className={styles.cardHead}>
                <h2 className={styles.cardTitle}>2. Destino de Lavandería y Datos Logísticos</h2>
                <span className={`${styles.statusPill} ${styles.pillInLaundry}`}>
                  Tiempo entrega: ~{activeProvider.tiempo_promedio_dias} días
                </span>
              </div>

              <div className={styles.formGrid}>
                {/* Selector de Lavandería */}
                <div className={styles.field}>
                  <label htmlFor="laundrySelect">Proveedor de Lavandería *</label>
                  <select
                    id="laundrySelect"
                    value={selectedProviderId}
                    onChange={(e) => setSelectedProviderId(e.target.value)}
                  >
                    {MOCK_LAUNDRY_PROVIDERS.map((prov) => (
                      <option key={prov.id} value={prov.id}>
                        {prov.razon_social} (Tarifa: {formatCOP(prov.tarifa_base_unidad)}/und)
                      </option>
                    ))}
                  </select>
                  <span className={styles.hint}>
                    {activeProvider.direccion} • {activeProvider.telefono}
                  </span>
                </div>

                {/* Fecha de Emisión y Retorno */}
                <div className={styles.field}>
                  <label htmlFor="fechaEmision">Fecha de Salida / Despacho *</label>
                  <input
                    id="fechaEmision"
                    type="date"
                    required
                    value={fechaEmision}
                    onChange={(e) => setFechaEmision(e.target.value)}
                  />
                </div>

                <div className={styles.field}>
                  <label htmlFor="fechaEntrega">Fecha Estimada de Retorno *</label>
                  <input
                    id="fechaEntrega"
                    type="date"
                    required
                    value={fechaEntrega}
                    onChange={(e) => setFechaEntrega(e.target.value)}
                  />
                  <span className={styles.hint}>Plazo acordado con el jefe de planta</span>
                </div>

                {/* Logística de Transporte */}
                <div className={styles.field}>
                  <label htmlFor="transportador">Conductor / Transportador Responsable</label>
                  <input
                    id="transportador"
                    type="text"
                    value={transportador}
                    onChange={(e) => setTransportador(e.target.value)}
                  />
                </div>

                <div className={styles.field}>
                  <label htmlFor="placa">Placa del Vehículo</label>
                  <input
                    id="placa"
                    type="text"
                    value={placaVehiculo}
                    onChange={(e) => setPlacaVehiculo(e.target.value)}
                  />
                </div>

                <div className={styles.field}>
                  <label htmlFor="tulas">Bultos / Tulas de Envío</label>
                  <input
                    id="tulas"
                    type="number"
                    min="1"
                    value={tulasBultos}
                    onChange={(e) => setTulasBultos(e.target.value)}
                  />
                </div>

                <div className={styles.field}>
                  <label htmlFor="peso">Peso Total Aprox. (Kg)</label>
                  <input
                    id="peso"
                    type="number"
                    min="0"
                    value={pesoKg}
                    onChange={(e) => setPesoKg(e.target.value)}
                  />
                </div>

                <div className={`${styles.field} ${styles.fullCol}`}>
                  <label htmlFor="observaciones">Observaciones Generales de la Remisión</label>
                  <textarea
                    id="observaciones"
                    rows="2"
                    placeholder="Notas para el conductor y control de entrega de la lavandería..."
                    value={observaciones}
                    onChange={(e) => setObservaciones(e.target.value)}
                  />
                </div>
              </div>
            </section>
          </div>

          {/* Columna Derecha: Resumen de Despacho Flotante */}
          <aside className={styles.summaryCard}>
            <h3 className={styles.summaryTitle}>Resumen de Despacho</h3>

            <div className={styles.summaryStatList}>
              <div className={styles.summaryStatRow}>
                <span className={styles.summaryStatLabel}>Lotes seleccionados:</span>
                <span className={styles.summaryStatValue}>{chosenLotsData.length} lote(s)</span>
              </div>
              <div className={styles.summaryStatRow}>
                <span className={styles.summaryStatLabel}>Lavandería destino:</span>
                <span className={styles.summaryStatValue} style={{ fontSize: '0.8rem', textAlign: 'right' }}>
                  {activeProvider.razon_social}
                </span>
              </div>
              <div className={styles.summaryStatRow}>
                <span className={styles.summaryStatLabel}>Tiempo estimado:</span>
                <span className={styles.summaryStatValue}>{activeProvider.tiempo_promedio_dias} días hábiles</span>
              </div>
              <div className={styles.summaryStatRow}>
                <span className={styles.summaryStatLabel}>Tarifa base / prenda:</span>
                <span className={styles.summaryStatValue}>{formatCOP(activeProvider.tarifa_base_unidad)}</span>
              </div>
            </div>

            <div className={styles.summaryTotalBox}>
              <div className={styles.summaryTotalLabel}>Total Prendas a Remitir</div>
              <div className={styles.summaryTotalAmount}>{totalPrendas} und</div>
              <span style={{ fontSize: '0.82rem', color: '#166534', fontWeight: 600 }}>
                Costo estimado servicio: {formatCOP(costoEstimadoTotal)}
              </span>
            </div>

            {chosenLotsData.length > 0 && (
              <div style={{ marginBottom: '1.25rem', background: '#f8fafc', padding: '0.75rem', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                <p style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', color: '#64748b', marginBottom: '0.4rem' }}>
                  Lotes en esta remisión:
                </p>
                <ul style={{ listStyle: 'none', fontSize: '0.82rem', color: '#334155', display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                  {chosenLotsData.map((l) => (
                    <li key={l.id} style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span><strong>{l.codigo_lote}</strong></span>
                      <strong style={{ color: '#0284c7' }}>{l.cantidad_a_enviar} und</strong>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div className={styles.actionButtons}>
              <button
                type="submit"
                disabled={chosenLotsData.length === 0}
                className={`${styles.btn} ${styles.btnPrimary}`}
              >
                Generar Remisión de Lavado
              </button>

              <button
                type="button"
                className={`${styles.btn} ${styles.btnSecondary}`}
                onClick={handleClear}
              >
                Limpiar Selección
              </button>
            </div>
          </aside>
        </form>
      )}

      {/* PESTAÑA 2: HISTORIAL DE REMISIONES */}
      {tab === 'historial' && (
        <section className={styles.card}>
          <div className={styles.cardHead}>
            <div>
              <h2 className={styles.cardTitle}>Historial de Remisiones a Lavandería</h2>
              <p className={styles.cardSubtitle}>
                Trazabilidad de guías de despacho en tránsito y prendas retornadas con control de calidad.
              </p>
            </div>
          </div>

          <div className={styles.tableContainer}>
            <table className={styles.dataTable}>
              <thead>
                <tr>
                  <th>N° Remisión</th>
                  <th>Fecha Salida</th>
                  <th>Retorno Estimado</th>
                  <th>Lavandería Proveedora</th>
                  <th>Lotes Incluidos</th>
                  <th className={styles.numeric}>Prendas</th>
                  <th>Proceso Químico</th>
                  <th>Transporte</th>
                  <th style={{ textAlign: 'center' }}>Estado</th>
                  <th style={{ textAlign: 'right' }}>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {remissionsList.map((rem) => (
                  <tr key={rem.id}>
                    <td>
                      <strong style={{ color: '#0284c7' }}>{rem.codigo}</strong>
                    </td>
                    <td>{rem.fecha_emision}</td>
                    <td>
                      <strong>{rem.fecha_entrega_estimada}</strong>
                    </td>
                    <td>
                      <strong>{rem.lavanderia_nombre}</strong>
                      <span style={{ display: 'block', fontSize: '0.75rem', color: '#64748b' }}>
                        {rem.contacto_lavanderia}
                      </span>
                    </td>
                    <td>
                      <span style={{ fontSize: '0.82rem' }}>
                        {rem.lotes_nombres?.join(', ') || `${rem.total_lotes} lote(s)`}
                      </span>
                    </td>
                    <td className={styles.numeric} style={{ fontWeight: 800 }}>
                      {rem.total_prendas} und
                    </td>
                    <td>
                      <span className={`${styles.statusPill} ${styles.pillInLaundry}`}>
                        {rem.receta_nombre}
                      </span>
                    </td>
                    <td>
                      <span style={{ fontSize: '0.82rem', color: '#475569' }}>
                        {rem.vehiculo_placa} • {rem.tulas_bultos} tulas
                      </span>
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <span
                        className={`${styles.statusPill} ${
                          rem.estado === 'RETORNADA' ? styles.pillReturned : styles.pillInLaundry
                        }`}
                      >
                        {rem.estado === 'RETORNADA' ? 'Retornada y Aprobada' : 'En Lavandería'}
                      </span>
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <button
                        type="button"
                        onClick={() => setActivePreviewDoc(rem)}
                        style={{
                          background: 'none',
                          border: 'none',
                          color: '#0284c7',
                          fontWeight: 700,
                          cursor: 'pointer',
                          fontSize: '0.85rem',
                          textDecoration: 'underline',
                        }}
                      >
                        Ver Guía
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* Modal de Vista Previa / Imprimir Documento de Remisión */}
      {activePreviewDoc && (
        <RemissionDocModal
          remission={activePreviewDoc}
          onClose={() => setActivePreviewDoc(null)}
          onPrint={() => window.print()}
        />
      )}
    </div>
  )
}
