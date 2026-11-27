import { useCallback, useEffect, useMemo, useState } from 'react'
import { apiGet, apiRequest } from '../../api/client'
import { useAuth } from '../../auth/session'
import { useToast } from '../ui/toastContext'
import Modal from '../ui/Modal'
import { fieldErrors } from '../Inventory/labels'
import styles from '../Inventory/Inventory.module.css'
import salesStyles from './Sales.module.css'
import { costDifferenceLabel, marginLabel, money, priceCostStatus } from './sales'

const BADGE_CLASS = {
  bajo_costo: salesStyles.badgeDanger,
  desactualizado: salesStyles.badgePending,
  incompleto: salesStyles.badgePending,
  al_dia: salesStyles.badgePaid,
  sin_ordenes: salesStyles.badgeMuted,
}

/**
 * Edición manual o adopción del costo calculado desde producción para una referencia (`PUT /api/ventas/precios/:ref/`
 * o `POST /api/ventas/precios/:ref/aplicar-costo/` cuando viene prellenado desde producción).
 */
function PriceForm({ item, applyCalculatedMode = false, onSaved, onClose }) {
  const notify = useToast()
  const [form, setForm] = useState({
    costo_fabrica: applyCalculatedMode && item.costo_calculado != null ? item.costo_calculado : (item.costo_fabrica ?? ''),
    precio_mayorista: item.precio_mayorista ?? '',
    precio_detal: item.precio_detal ?? '',
    motivo: '',
  })
  const [errors, setErrors] = useState({})
  const [saving, setSaving] = useState(false)
  const set = (name) => (event) => setForm((current) => ({ ...current, [name]: event.target.value }))
  const err = (name) => errors[name] && <span className={styles.fieldError}>{errors[name]}</span>

  const numeric = (value) => (/^\d+$/.test(String(value).trim()) ? Number(value) : value)
  const submit = async (event) => {
    event.preventDefault()
    setSaving(true)
    setErrors({})
    try {
      if (applyCalculatedMode) {
        await apiRequest(`/api/ventas/precios/${item.referencia}/aplicar-costo/`, {
          method: 'POST',
          body: {
            precio_mayorista: numeric(form.precio_mayorista),
            precio_detal: numeric(form.precio_detal),
            motivo: String(form.motivo || '').trim(),
          },
        })
      } else {
        await apiRequest(`/api/ventas/precios/${item.referencia}/`, {
          method: 'PUT',
          body: {
            costo_fabrica: numeric(form.costo_fabrica),
            precio_mayorista: numeric(form.precio_mayorista),
            precio_detal: numeric(form.precio_detal),
            motivo: String(form.motivo || '').trim(),
          },
        })
      }
      notify(`Precios de ${item.codigo} guardados.`)
      onSaved()
    } catch (error) {
      setErrors(fieldErrors(error))
      setSaving(false)
    }
  }

  return (
    <Modal
      title={`${applyCalculatedMode ? 'Subir precio y aplicar costo' : 'Precios de'} ${item.codigo} · ${item.nombre}`}
      onClose={onClose}
    >
      <form className={styles.form} onSubmit={submit} noValidate>
        <p className={styles.muted}>
          En pesos enteros y antes de IVA. El precio mayorista no puede ser menor al costo de fábrica ni el de detal menor al mayorista.
        </p>
        {item.precio_bajo_costo && (
          <p className={salesStyles.problems}>
            El costo calculado desde producción ({money(item.costo_calculado)}) supera el precio mayorista vigente ({money(item.precio_mayorista)}). Debes subir el precio mayorista antes de aplicar este costo.
          </p>
        )}
        <label className={styles.field}>
          Costo de fábrica (el piso de venta)
          <input
            value={form.costo_fabrica}
            onChange={set('costo_fabrica')}
            inputMode="numeric"
            readOnly={applyCalculatedMode}
          />
          {item.costo_calculado != null && !applyCalculatedMode && Number(form.costo_fabrica) !== item.costo_calculado && (
            <button
              type="button"
              className={styles.linkBtn}
              onClick={() => setForm((current) => ({ ...current, costo_fabrica: item.costo_calculado }))}
            >
              Usar costo calculado ({money(item.costo_calculado)})
            </button>
          )}
          {err('costo_fabrica')}
        </label>
        <label className={styles.field}>
          Precio mayorista
          <input value={form.precio_mayorista} onChange={set('precio_mayorista')} inputMode="numeric" />
          {err('precio_mayorista')}
        </label>
        <label className={styles.field}>
          Precio detal
          <input value={form.precio_detal} onChange={set('precio_detal')} inputMode="numeric" />
          {err('precio_detal')}
        </label>
        <label className={styles.field}>
          Motivo del ajuste (opcional)
          <input value={form.motivo} onChange={set('motivo')} placeholder="Ej. Actualización por costo real de lote" />
        </label>
        {(errors.detail || errors.costo_calculado) && (
          <p className={styles.formError}>{errors.detail || errors.costo_calculado}</p>
        )}
        <div className={styles.actions}>
          <button type="button" className={styles.secondaryBtn} onClick={onClose}>Cancelar</button>
          <button type="submit" className={styles.primaryBtn} disabled={saving}>
            {saving ? 'Guardando…' : (applyCalculatedMode ? 'Aplicar costo y precios' : 'Guardar')}
          </button>
        </div>
      </form>
    </Modal>
  )
}

/**
 * Desglose de órdenes terminadas (y faltantes si el costo está incompleto) calculado en los últimos 90 días.
 */
function CostBreakdownModal({ item, onClose }) {
  const calc = item.calculo_produccion || { ordenes: [], faltantes: [], ventana_dias: 90 }
  return (
    <Modal title={`Cálculo de producción · ${item.codigo} · ${item.nombre}`} onClose={onClose} wide>
      <p className={styles.muted}>
        Promedio ponderado por prendas aptas de órdenes terminadas en los últimos {calc.ventana_dias} días:
        (materiales + mano de obra + servicio de lavandería) ÷ prendas aptas.
      </p>
      {calc.faltantes?.length > 0 && (
        <div className={salesStyles.problems} style={{ marginBottom: '0.85rem' }}>
          <strong>Faltan datos para completar el costo:</strong>
          <ul style={{ margin: '0.35rem 0 0 1.2rem' }}>
            {calc.faltantes.map((msg, idx) => <li key={idx}>{msg}</li>)}
          </ul>
        </div>
      )}
      {calc.ordenes?.length === 0 ? (
        <p className={styles.empty}>No hay órdenes terminadas con inspección de calidad en esta ventana.</p>
      ) : (
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Orden</th><th>Cierre</th><th className={styles.num}>Aptas</th>
                <th className={styles.num}>Materiales</th><th className={styles.num}>Mano de obra</th>
                <th className={styles.num}>Lavandería</th><th className={styles.num}>Total</th>
                <th className={styles.num}>Costo / prenda</th><th>Estado</th>
              </tr>
            </thead>
            <tbody>
              {calc.ordenes.map((ord) => (
                <tr key={ord.orden_id}>
                  <td><strong>{ord.codigo}</strong></td>
                  <td>{ord.fecha_cierre}</td>
                  <td className={styles.num}>{ord.prendas_aptas}</td>
                  <td className={styles.num}>{money(ord.materiales)}</td>
                  <td className={styles.num}>{money(ord.mano_obra)}</td>
                  <td className={styles.num}>{money(ord.lavanderia)}</td>
                  <td className={styles.num}>{money(ord.costo_total)}</td>
                  <td className={styles.num}>{ord.costo_por_prenda == null ? '—' : money(ord.costo_por_prenda)}</td>
                  <td>{ord.completa ? 'Completa' : (ord.faltantes?.join(', ') || 'Incompleta')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <div className={styles.actions} style={{ marginTop: '1rem' }}>
        <button type="button" className={styles.secondaryBtn} onClick={onClose}>Cerrar</button>
      </div>
    </Modal>
  )
}

/**
 * Historial de cambios de costo de fábrica y precios (`GET /api/ventas/precios/:ref/historial/`).
 */
function PriceHistoryModal({ item, onClose }) {
  const [rows, setRows] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    apiGet(`/api/ventas/precios/${item.referencia}/historial/`)
      .then((data) => (setRows(data), setError('')))
      .catch((err) => setError(err.message))
  }, [item.referencia])

  return (
    <Modal title={`Historial de precios · ${item.codigo} · ${item.nombre}`} onClose={onClose} wide>
      {error && <p className={styles.formError}>{error}</p>}
      {!error && rows === null && <p className={styles.muted}>Cargando historial…</p>}
      {rows && rows.length === 0 && <p className={styles.empty}>Esta referencia aún no tiene cambios registrados.</p>}
      {rows && rows.length > 0 && (
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Fecha</th><th>Usuario</th><th>Origen</th>
                <th className={styles.num}>Costo fábrica</th>
                <th className={styles.num}>Mayorista</th>
                <th className={styles.num}>Detal</th>
                <th>Órdenes / Motivo</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id}>
                  <td>{String(row.created_at).slice(0, 16).replace('T', ' ')}</td>
                  <td>{row.usuario_nombre || '—'}</td>
                  <td>{row.origen_nombre}</td>
                  <td className={styles.num}>
                    {row.costo_fabrica_anterior == null ? '—' : money(row.costo_fabrica_anterior)} → <strong>{money(row.costo_fabrica_nuevo)}</strong>
                  </td>
                  <td className={styles.num}>
                    {row.precio_mayorista_anterior == null ? '—' : money(row.precio_mayorista_anterior)} → {money(row.precio_mayorista_nuevo)}
                  </td>
                  <td className={styles.num}>
                    {row.precio_detal_anterior == null ? '—' : money(row.precio_detal_anterior)} → {money(row.precio_detal_nuevo)}
                  </td>
                  <td>
                    {row.ordenes_respaldo?.length > 0 && <div><strong>{row.ordenes_respaldo.join(', ')}</strong></div>}
                    {row.motivo && <div className={styles.muted}>{row.motivo}</div>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <div className={styles.actions} style={{ marginTop: '1rem' }}>
        <button type="button" className={styles.secondaryBtn} onClick={onClose}>Cerrar</button>
      </div>
    </Modal>
  )
}

/**
 * Ventas · Precios, ruta `/ventas/precios` (`ventas.ver`): costo de fábrica y precios de venta por referencia.
 * Quienes tienen `ventas.precios` (Gerente y Administrador) ven el costo sugerido desde producción, alertas de desfase
 * o precio bajo costo, el desglose por órdenes, el historial de cambios y el botón para aplicar el costo.
 */
export default function PricesPage() {
  const { can } = useAuth()
  const notify = useToast()
  const canEdit = can('ventas.precios')
  const [rows, setRows] = useState(null)
  const [search, setSearch] = useState('')
  const [loadError, setLoadError] = useState('')
  const [editing, setEditing] = useState(null)
  const [applyTarget, setApplyTarget] = useState(null)
  const [breakdownItem, setBreakdownItem] = useState(null)
  const [historyItem, setHistoryItem] = useState(null)
  const [applyingId, setApplyingId] = useState(null)

  const load = useCallback(() => {
    const params = new URLSearchParams()
    if (search.trim()) params.set('q', search.trim())
    apiGet(`/api/ventas/precios/?${params}`).then((data) => (setRows(data), setLoadError(''))).catch((error) => { setRows(null); setLoadError(error.message) })
  }, [search])

  useEffect(() => {
    const timer = setTimeout(load, 250)
    return () => clearTimeout(timer)
  }, [load])

  const alerts = useMemo(() => {
    if (!canEdit || !rows) return { belowCost: 0, outdated: 0 }
    return {
      belowCost: rows.filter((r) => r.precio_bajo_costo).length,
      outdated: rows.filter((r) => r.costo_desactualizado).length,
    }
  }, [canEdit, rows])

  const quickApply = async (item) => {
    setApplyingId(item.referencia)
    try {
      await apiRequest(`/api/ventas/precios/${item.referencia}/aplicar-costo/`, { method: 'POST', body: {} })
      notify(`Costo calculado (${money(item.costo_calculado)}) aplicado a ${item.codigo}.`)
      load()
    } catch (error) {
      notify(error.message || 'No se pudo aplicar el costo calculado.', 'error')
    } finally {
      setApplyingId(null)
    }
  }

  return (
    <div className={styles.page}>
      <header className={styles.pageHeader}>
        <p className={styles.eyebrow}>Ventas y despachos</p>
        <h1>Precios de venta</h1>
        <p className={styles.subtitle}>
          Costo de fábrica y precios por referencia, en pesos y antes de IVA. Ninguna venta, ni con descuento, puede quedar por debajo del costo de fábrica.
        </p>
      </header>

      {canEdit && (alerts.belowCost > 0 || alerts.outdated > 0) && (
        <div className={salesStyles.notice} role="status">
          <span>
            {alerts.belowCost > 0
              ? `${alerts.belowCost} referencia(s) tienen el costo calculado por encima del precio mayorista.`
              : `${alerts.outdated} referencia(s) tienen un costo calculado mayor al costo de fábrica vigente.`}
          </span>
        </div>
      )}

      <section className={styles.card}>
        <div className={styles.filters}>
          <input type="search" placeholder="Buscar referencia" value={search} onChange={(event) => setSearch(event.target.value)} aria-label="Buscar referencias" />
        </div>
        {loadError && <p className={styles.formError}>{loadError}</p>}
        {rows && rows.length === 0 && <p className={styles.empty}>No hay referencias activas para mostrar.</p>}
        {rows && rows.length > 0 && (
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Referencia</th>
                  <th className={styles.num}>Costo de fábrica</th>
                  {canEdit && <th className={styles.num}>Costo calculado</th>}
                  {canEdit && <th className={styles.num}>Diferencia</th>}
                  {canEdit && <th>Estado costo</th>}
                  <th className={styles.num}>Mayorista</th>
                  <th className={styles.num}>Margen</th>
                  <th className={styles.num}>Detal</th>
                  <th className={styles.num}>Margen</th>
                  {canEdit && <th />}
                </tr>
              </thead>
              <tbody>
                {rows.map((item) => {
                  const statusInfo = canEdit ? priceCostStatus(item) : null
                  const calc = item.calculo_produccion
                  const totalOrders = calc?.ordenes?.length ?? 0
                  return (
                    <tr key={item.referencia}>
                      <td><strong>{item.codigo}</strong> · {item.nombre}</td>
                      <td className={styles.num}>{item.costo_fabrica == null ? '—' : money(item.costo_fabrica)}</td>
                      {canEdit && (
                        <td className={styles.num}>
                          {item.costo_calculado != null ? (
                            <>
                              <strong>{money(item.costo_calculado)}</strong>
                              {totalOrders > 0 && (
                                <div>
                                  <button type="button" className={styles.linkBtn} onClick={() => setBreakdownItem(item)}>
                                    Ver {totalOrders} {totalOrders === 1 ? 'orden' : 'órdenes'}
                                  </button>
                                </div>
                              )}
                            </>
                          ) : statusInfo?.kind === 'incompleto' ? (
                            <button type="button" className={styles.linkBtn} onClick={() => setBreakdownItem(item)}>
                              Ver faltantes
                            </button>
                          ) : '—'}
                        </td>
                      )}
                      {canEdit && (
                        <td className={styles.num}>{costDifferenceLabel(item.costo_calculado, item.costo_fabrica)}</td>
                      )}
                      {canEdit && statusInfo && (
                        <td>
                          <span className={BADGE_CLASS[statusInfo.kind]}>{statusInfo.label}</span>
                        </td>
                      )}
                      <td className={styles.num}>{item.precio_mayorista == null ? 'Sin precio' : money(item.precio_mayorista)}</td>
                      <td className={styles.num}>{marginLabel(item.precio_mayorista, item.costo_fabrica)}</td>
                      <td className={styles.num}>{item.precio_detal == null ? 'Sin precio' : money(item.precio_detal)}</td>
                      <td className={styles.num}>{marginLabel(item.precio_detal, item.costo_fabrica)}</td>
                      {canEdit && (
                        <td>
                          <div className={salesStyles.cellActions}>
                            {statusInfo.canQuickApply && item.costo_calculado !== item.costo_fabrica && (
                              <button
                                type="button"
                                className={salesStyles.quickBtnPay}
                                disabled={applyingId === item.referencia}
                                onClick={() => quickApply(item)}
                              >
                                {applyingId === item.referencia ? 'Aplicando…' : 'Aplicar costo'}
                              </button>
                            )}
                            {statusInfo.needsPriceIncrease && item.costo_calculado != null && (
                              <button
                                type="button"
                                className={salesStyles.quickBtnReturn}
                                onClick={() => setApplyTarget(item)}
                              >
                                Subir precio y aplicar
                              </button>
                            )}
                            <button type="button" className={styles.linkBtn} onClick={() => setEditing(item)}>
                              {item.costo_fabrica == null ? 'Registrar' : 'Editar'}
                            </button>
                            <button type="button" className={styles.linkBtn} onClick={() => setHistoryItem(item)}>
                              Historial
                            </button>
                          </div>
                        </td>
                      )}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {editing && (
        <PriceForm item={editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); load() }} />
      )}
      {applyTarget && (
        <PriceForm
          item={applyTarget}
          applyCalculatedMode
          onClose={() => setApplyTarget(null)}
          onSaved={() => { setApplyTarget(null); load() }}
        />
      )}
      {breakdownItem && <CostBreakdownModal item={breakdownItem} onClose={() => setBreakdownItem(null)} />}
      {historyItem && <PriceHistoryModal item={historyItem} onClose={() => setHistoryItem(null)} />}
    </div>
  )
}
