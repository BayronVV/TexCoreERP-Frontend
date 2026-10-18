import { useCallback, useEffect, useState } from 'react'
import { apiGet, apiRequest } from '../../api/client'
import { useAuth } from '../../auth/session'
import { useToast } from '../ui/toastContext'
import { fieldErrors } from '../Inventory/labels'
import styles from '../Inventory/Inventory.module.css'
import resourceStyles from './Resources.module.css'
import { MachineForm, OperatorForm } from './ResourceForms'
import { MACHINE_STATES, PAY_TYPES, STAGES, stagesText } from './resources'

const MACHINE_BADGE = { DISPONIBLE: styles.badgeOk, MANTENIMIENTO: styles.badgeWarn, FUERA_SERVICIO: styles.badgeDanger }
const payLabel = (value) => PAY_TYPES.find((pay) => pay.value === value)?.label ?? value
const stateLabel = (value) => MACHINE_STATES.find((state) => state.value === value)?.label ?? value

function BusyNote({ places }) {
  return places?.length ? <span className={resourceStyles.busyNote}>Ocupado en {places.join(', ')}</span> : null
}

function OperatorsTable({ items, canManage, onEdit, onToggle }) {
  return (
    <div className={styles.tableWrap}>
      <table className={styles.table}>
        <thead>
          <tr><th>Código</th><th>Nombre</th><th>Documento</th><th>Etapas</th><th>Pago</th><th>Estado</th>{canManage && <th />}</tr>
        </thead>
        <tbody>
          {items.map((operator) => (
            <tr key={operator.id} className={operator.activo ? '' : resourceStyles.inactiveRow}>
              <td>{operator.codigo}</td>
              <td><strong>{operator.nombres}</strong></td>
              <td>{operator.documento || '—'}</td>
              <td>{stagesText(operator.etapas)}</td>
              <td>{payLabel(operator.tipo_pago)}</td>
              <td>
                <span className={`${styles.badge} ${operator.activo ? styles.badgeOk : styles.badgeOff}`}>{operator.activo ? 'Activo' : 'Inactivo'}</span>
                <BusyNote places={operator.ocupado_en} />
              </td>
              {canManage && (
                <td>
                  <span className={resourceStyles.rowActions}>
                    <button type="button" className={styles.linkBtn} onClick={() => onEdit(operator)}>Editar</button>
                    <button type="button" className={`${styles.linkBtn} ${operator.activo ? styles.dangerText : ''}`} onClick={() => onToggle(operator)}>
                      {operator.activo ? 'Desactivar' : 'Activar'}
                    </button>
                  </span>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function MachinesTable({ items, canManage, onEdit, onToggle }) {
  return (
    <div className={styles.tableWrap}>
      <table className={styles.table}>
        <thead>
          <tr><th>Código</th><th>Tipo</th><th>Marca y modelo</th><th>Ubicación</th><th>Etapas</th><th>Estado</th>{canManage && <th />}</tr>
        </thead>
        <tbody>
          {items.map((machine) => (
            <tr key={machine.id} className={machine.activo ? '' : resourceStyles.inactiveRow}>
              <td>{machine.codigo}</td>
              <td><strong>{machine.tipo_nombre}</strong></td>
              <td>{machine.marca_modelo || '—'}</td>
              <td>{machine.ubicacion || '—'}</td>
              <td>{stagesText(machine.etapas)}</td>
              <td>
                {machine.activo ? (
                  <span className={`${styles.badge} ${MACHINE_BADGE[machine.estado] ?? ''}`}>{stateLabel(machine.estado)}</span>
                ) : (
                  <span className={`${styles.badge} ${styles.badgeOff}`}>Inactiva</span>
                )}
                <BusyNote places={machine.ocupada_en} />
              </td>
              {canManage && (
                <td>
                  <span className={resourceStyles.rowActions}>
                    <button type="button" className={styles.linkBtn} onClick={() => onEdit(machine)}>Editar</button>
                    <button type="button" className={`${styles.linkBtn} ${machine.activo ? styles.dangerText : ''}`} onClick={() => onToggle(machine)}>
                      {machine.activo ? 'Desactivar' : 'Activar'}
                    </button>
                  </span>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// Catálogo de operarios y máquinas del taller (HU 4.4 / RF14). Nada se borra: se desactiva para conservar el historial.
export default function ResourcesPage() {
  const { can } = useAuth()
  const notify = useToast()
  const canManage = can('produccion.gestionar')
  const [tab, setTab] = useState('operarios')
  const [items, setItems] = useState({ operarios: null, maquinas: null })
  const [loadError, setLoadError] = useState('')
  const [search, setSearch] = useState('')
  const [stage, setStage] = useState('')
  const [showInactive, setShowInactive] = useState(false)
  const [editing, setEditing] = useState(null) // null | 'new' | registro

  const load = useCallback(() => {
    const params = new URLSearchParams()
    if (search.trim()) params.set('q', search.trim())
    if (stage) params.set('etapa', stage)
    if (!showInactive) params.set('activo', '1')
    apiGet(`/api/produccion/${tab}/?${params}`)
      .then((data) => (setItems((current) => ({ ...current, [tab]: data })), setLoadError('')))
      .catch((error) => setLoadError(error.message))
  }, [tab, search, stage, showInactive])

  useEffect(() => {
    const timer = setTimeout(load, 250)
    return () => clearTimeout(timer)
  }, [load])

  const switchTab = (next) => {
    setTab(next)
    setEditing(null)
    setSearch('')
    setStage('')
  }

  const toggle = async (item) => {
    const verb = item.activo ? 'desactivar' : 'activar'
    if (item.activo && !window.confirm(`¿Desactivar ${item.nombres ?? item.codigo}? Deja de aparecer para asignar, pero su historial se conserva.`)) return
    try {
      const saved = await apiRequest(`/api/produccion/${tab}/${item.id}/`, { method: 'PATCH', body: { activo: !item.activo } })
      notify(item.activo ? 'Desactivado.' : 'Activado.')
      ;(saved.advertencias ?? []).forEach((warning) => notify(warning, 'warn'))
      load()
    } catch (error) {
      notify(fieldErrors(error).detail ?? error.message ?? `No se pudo ${verb}.`, 'error')
    }
  }

  const list = items[tab]
  const isOperators = tab === 'operarios'

  return (
    <div className={styles.page}>
      <header className={`${styles.pageHeader} ${resourceStyles.headerRow}`}>
        <div>
          <p className={styles.eyebrow}>Producción y trazabilidad</p>
          <h1>Recursos del taller</h1>
          <p className={styles.subtitle}>
            Operarios y máquinas que se asignan a las etapas de cada lote. Los operarios no necesitan usuario del sistema.
          </p>
        </div>
        {canManage && (
          <button type="button" className={styles.primaryBtn} onClick={() => setEditing('new')}>
            {isOperators ? '+ Registrar operario' : '+ Registrar máquina'}
          </button>
        )}
      </header>

      <div className={styles.tabs} role="tablist">
        {[['operarios', 'Operarios'], ['maquinas', 'Máquinas']].map(([id, label]) => (
          <button
            key={id} type="button" role="tab" aria-selected={tab === id}
            className={`${styles.tab} ${tab === id ? styles.tabActive : ''}`} onClick={() => switchTab(id)}
          >
            {label}
          </button>
        ))}
      </div>

      <section className={styles.card}>
        <div className={styles.filters}>
          <input
            type="search" placeholder={isOperators ? 'Buscar por nombre, código o documento' : 'Buscar por código, marca, ubicación o serial'}
            value={search} onChange={(event) => setSearch(event.target.value)} aria-label="Buscar"
          />
          <select value={stage} onChange={(event) => setStage(event.target.value)} aria-label="Filtrar por etapa">
            <option value="">Todas las etapas</option>
            {STAGES.map((option) => <option key={option.code} value={option.code}>{option.name}</option>)}
          </select>
          <label className={resourceStyles.check}>
            <input type="checkbox" checked={showInactive} onChange={(event) => setShowInactive(event.target.checked)} />
            Ver inactivos
          </label>
        </div>
        {loadError && <p className={styles.formError}>{loadError}</p>}
        {list && list.length === 0 && (
          <p className={styles.empty}>
            {search || stage || showInactive
              ? 'Ningún registro coincide con el filtro.'
              : `Todavía no hay ${isOperators ? 'operarios' : 'máquinas'}.${canManage ? ' Registra el primero.' : ''}`}
          </p>
        )}
        {list && list.length > 0 && (isOperators
          ? <OperatorsTable items={list} canManage={canManage} onEdit={setEditing} onToggle={toggle} />
          : <MachinesTable items={list} canManage={canManage} onEdit={setEditing} onToggle={toggle} />)}
        {!canManage && <p className={styles.muted}>Tu rol puede consultar los recursos pero no cambiarlos.</p>}
      </section>

      {editing && isOperators && (
        <OperatorForm operator={editing === 'new' ? null : editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); load() }} />
      )}
      {editing && !isOperators && (
        <MachineForm machine={editing === 'new' ? null : editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); load() }} />
      )}
    </div>
  )
}
