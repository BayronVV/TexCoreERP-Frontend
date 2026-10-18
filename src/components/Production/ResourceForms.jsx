import { useState } from 'react'
import { apiRequest } from '../../api/client'
import { useToast } from '../ui/toastContext'
import Modal from '../ui/Modal'
import { fieldErrors } from '../Inventory/labels'
import styles from '../Inventory/Inventory.module.css'
import resourceStyles from './Resources.module.css'
import {
  MACHINE_STATES, MACHINE_TYPES, PAY_TYPES, STAGES, emptyMachine, emptyOperator, machineErrors, machineForm, machinePayload,
  operatorErrors, operatorForm, operatorPayload, toggleStage,
} from './resources'

/** Casillas de las etapas en las que se puede trabajar o se usa el recurso. */
function StageChecks({ value, onChange, error }) {
  return (
    <div className={`${styles.field} ${styles.full}`}>
      <span>Etapas</span>
      <div className={resourceStyles.stageChecks} role="group" aria-label="Etapas">
        {STAGES.map((stage) => (
          <label key={stage.code}>
            <input type="checkbox" checked={value.includes(stage.code)} onChange={() => onChange(toggleStage(value, stage.code))} />
            {stage.name}
          </label>
        ))}
      </div>
      {error && <span className={styles.fieldError}>{error}</span>}
    </div>
  )
}

// Formulario compartido: guarda con POST (nuevo) o PATCH (edición) y muestra los errores del servidor junto a cada campo.
function useResourceForm({ initial, validate, buildBody, path, editing, savedText, onSaved }) {
  const notify = useToast()
  const [form, setForm] = useState(initial)
  const [errors, setErrors] = useState({})
  const [saving, setSaving] = useState(false)
  const set = (field) => (event) => setForm((current) => ({ ...current, [field]: event.target.value }))

  const submit = async (event) => {
    event.preventDefault()
    const problems = validate(form)
    setErrors(problems)
    if (Object.keys(problems).length) return
    setSaving(true)
    try {
      const saved = await apiRequest(editing ? `${path}${editing.id}/` : path, { method: editing ? 'PATCH' : 'POST', body: buildBody(form) })
      notify(savedText)
      ;(saved.advertencias ?? []).forEach((warning) => notify(warning, 'warn'))
      onSaved(saved)
    } catch (error) {
      setErrors(fieldErrors(error))
      setSaving(false)
    }
  }
  return { form, setForm, set, errors, saving, submit }
}

// Catálogo de operarios (RF14): no exige un usuario del sistema, solo lo que producción necesita.
export function OperatorForm({ operator, onSaved, onClose }) {
  const { form, setForm, set, errors, saving, submit } = useResourceForm({
    initial: operator ? operatorForm(operator) : emptyOperator(), validate: operatorErrors, buildBody: operatorPayload,
    path: '/api/produccion/operarios/', editing: operator, savedText: operator ? 'Operario actualizado.' : 'Operario registrado.', onSaved,
  })
  const err = (name) => errors[name] && <span className={styles.fieldError}>{errors[name]}</span>

  return (
    <Modal title={operator ? `Editar operario ${operator.codigo}` : 'Registrar operario'} onClose={onClose} wide>
      <form className={styles.form} onSubmit={submit} noValidate>
        <div className={styles.grid}>
          <label className={`${styles.field} ${styles.full}`}>
            Nombre completo
            <input value={form.nombres} onChange={set('nombres')} required maxLength={120} placeholder="Ej. Ana María Pérez" />
            {err('nombres')}
          </label>
          <label className={styles.field}>
            Documento (opcional)
            <input value={form.documento} onChange={set('documento')} maxLength={15} inputMode="numeric" placeholder="Solo dígitos" />
            <span className={styles.hint}>Si lo escribes, debe ser único.</span>
            {err('documento')}
          </label>
          <label className={styles.field}>
            Forma de pago
            <select value={form.tipo_pago} onChange={set('tipo_pago')}>
              {PAY_TYPES.map((pay) => <option key={pay.value} value={pay.value}>{pay.label}</option>)}
            </select>
            <span className={styles.hint}>Solo informativo: la nómina no se maneja aquí.</span>
            {err('tipo_pago')}
          </label>
          <StageChecks value={form.etapas} onChange={(etapas) => setForm((current) => ({ ...current, etapas }))} error={errors.etapas} />
        </div>
        {errors.detail && <p className={styles.formError}>{errors.detail}</p>}
        <div className={styles.actions}>
          <button type="button" className={styles.secondaryBtn} onClick={onClose}>Cancelar</button>
          <button type="submit" className={styles.primaryBtn} disabled={saving}>
            {saving ? 'Guardando…' : operator ? 'Guardar cambios' : 'Registrar operario'}
          </button>
        </div>
      </form>
    </Modal>
  )
}

export function MachineForm({ machine, onSaved, onClose }) {
  const { form, setForm, set, errors, saving, submit } = useResourceForm({
    initial: machine ? machineForm(machine) : emptyMachine(), validate: machineErrors, buildBody: machinePayload,
    path: '/api/produccion/maquinas/', editing: machine, savedText: machine ? 'Máquina actualizada.' : 'Máquina registrada.', onSaved,
  })
  const err = (name) => errors[name] && <span className={styles.fieldError}>{errors[name]}</span>

  return (
    <Modal title={machine ? `Editar máquina ${machine.codigo}` : 'Registrar máquina'} onClose={onClose} wide>
      <form className={styles.form} onSubmit={submit} noValidate>
        <div className={styles.grid}>
          <label className={styles.field}>
            Tipo de máquina
            <select value={form.tipo} onChange={set('tipo')} required>
              <option value="">Selecciona</option>
              {MACHINE_TYPES.map((type) => <option key={type.value} value={type.value}>{type.label}</option>)}
            </select>
            {err('tipo')}
          </label>
          <label className={styles.field}>
            Estado
            <select value={form.estado} onChange={set('estado')}>
              {MACHINE_STATES.map((state) => <option key={state.value} value={state.value}>{state.label}</option>)}
            </select>
            <span className={styles.hint}>Solo lo físico. «Ocupada» se calcula con las etapas en curso.</span>
            {err('estado')}
          </label>
          <label className={styles.field}>
            Marca y modelo (opcional)
            <input value={form.marca_modelo} onChange={set('marca_modelo')} maxLength={120} />
            {err('marca_modelo')}
          </label>
          <label className={styles.field}>
            Serial (opcional)
            <input value={form.serial} onChange={set('serial')} maxLength={60} />
            {err('serial')}
          </label>
          <label className={styles.field}>
            Ubicación o línea (opcional)
            <input value={form.ubicacion} onChange={set('ubicacion')} maxLength={80} placeholder="Ej. Línea 1" />
            {err('ubicacion')}
          </label>
          <label className={styles.field}>
            Observaciones (opcional)
            <input value={form.observaciones} onChange={set('observaciones')} maxLength={255} />
            {err('observaciones')}
          </label>
          <StageChecks value={form.etapas} onChange={(etapas) => setForm((current) => ({ ...current, etapas }))} error={errors.etapas} />
        </div>
        {errors.detail && <p className={styles.formError}>{errors.detail}</p>}
        <div className={styles.actions}>
          <button type="button" className={styles.secondaryBtn} onClick={onClose}>Cancelar</button>
          <button type="submit" className={styles.primaryBtn} disabled={saving}>
            {saving ? 'Guardando…' : machine ? 'Guardar cambios' : 'Registrar máquina'}
          </button>
        </div>
      </form>
    </Modal>
  )
}
