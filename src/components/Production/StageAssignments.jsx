import { useState } from 'react'
import { apiRequest } from '../../api/client'
import { fieldErrors } from '../Inventory/labels'
import { useToast } from '../ui/toastContext'
import styles from '../Inventory/Inventory.module.css'
import resourceStyles from './Resources.module.css'
import { assignBody, describeAssignment, editableStage, pickerOptions, selectedIds } from './resources'

function Picker({ kind, label, stage, items, disabled, onPick }) {
  const current = stage.asignacion?.[kind] ?? null
  const options = pickerOptions(kind, items, stage.etapa, current)
  const value = selectedIds(stage)[kind]
  return (
    <label className={resourceStyles.assignField}>
      <span className={styles.muted}>{label}</span>
      <select value={value} disabled={disabled} onChange={(event) => onPick(kind, event.target.value)} aria-label={`${label} de ${stage.etapa_nombre}`}>
        <option value="">Sin asignar</option>
        {options.map((option) => (
          <option key={option.id} value={option.id}>
            {option.label}{option.stale ? ' (ya no disponible)' : ''}{option.busy ? ` · ${option.busy}` : ''}
          </option>
        ))}
      </select>
    </label>
  )
}

// Operario y máquina de cada etapa de un lote (HU 4.4 / RF14). Cada cambio se guarda al instante, sin recargar la vista: el
// servidor cierra la asignación anterior y abre otra, así queda el historial. Los avisos de ocupación no bloquean.
export default function StageAssignments({ lot, canManage, catalog, onReloadCatalog, onChange }) {
  const notify = useToast()
  const [saving, setSaving] = useState('')
  const [error, setError] = useState('')
  const editable = canManage && lot.estado !== 'CANCELADA'

  const pick = async (stage, kind, value) => {
    setSaving(stage.etapa)
    setError('')
    try {
      const saved = await apiRequest(`/api/produccion/lotes/${lot.id}/asignar/`, { method: 'POST', body: assignBody(stage.etapa, kind, value) })
      onChange(saved.lote)
      saved.advertencias.forEach((warning) => notify(warning, 'warn'))
      onReloadCatalog()
    } catch (failure) {
      const fields = fieldErrors(failure)
      setError(fields.operario ?? fields.maquina ?? fields.etapa ?? fields.orden ?? failure.message)
    } finally {
      setSaving('')
    }
  }

  return (
    <div>
      <p className={resourceStyles.assignTitle}>Operario y máquina por etapa</p>
      {lot.etapas.map((stage) => (
        <div key={stage.id} className={resourceStyles.assignRow}>
          <span className={resourceStyles.assignStage}>{stage.etapa_nombre}</span>
          {editable && editableStage(stage) ? (
            <>
              <Picker kind="operario" label="Operario" stage={stage} items={catalog.operarios} disabled={saving !== ''} onPick={(kind, value) => pick(stage, kind, value)} />
              <Picker kind="maquina" label="Máquina" stage={stage} items={catalog.maquinas} disabled={saving !== ''} onPick={(kind, value) => pick(stage, kind, value)} />
            </>
          ) : (
            <span className={resourceStyles.assignDone}>
              {stage.estado === 'COMPLETADA' ? 'Terminada · el historial muestra quién la trabajó' : describeAssignment(stage.asignacion)}
            </span>
          )}
        </div>
      ))}
      {error && <span className={styles.fieldError} role="alert">{error}</span>}
    </div>
  )
}
