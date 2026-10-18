// Operarios, máquinas y su asignación a las etapas de un lote (HU 4.4 / RF14). Funciones puras, sin React ni DOM, para
// probarlas con `node --test`. El servidor valida todo; aquí solo se ofrece lo que tiene sentido y se avisa antes de enviar.

export const STAGES = [
  { code: 'CORTE', name: 'Corte' },
  { code: 'CONFECCION', name: 'Confección' },
  { code: 'TERMINACION', name: 'Terminación' },
]

export const PAY_TYPES = [
  { value: 'PIEZA', label: 'Por pieza' },
  { value: 'TIEMPO', label: 'Por tiempo' },
  { value: 'SALARIO', label: 'Salario' },
]

export const MACHINE_TYPES = [
  { value: 'PLANA', label: 'Plana de una aguja' },
  { value: 'PLANA_DOBLE', label: 'Plana de dos agujas' },
  { value: 'FILETEADORA', label: 'Fileteadora' },
  { value: 'COLLARIN', label: 'Collarín' },
  { value: 'PRESILLADORA', label: 'Presilladora' },
  { value: 'OJALADORA', label: 'Ojaladora' },
  { value: 'BOTONADORA', label: 'Botonadora' },
  { value: 'REMACHADORA', label: 'Remachadora' },
  { value: 'CORTADORA', label: 'Cortadora de tela' },
  { value: 'OTRA', label: 'Otra' },
]

export const MACHINE_STATES = [
  { value: 'DISPONIBLE', label: 'Disponible' },
  { value: 'MANTENIMIENTO', label: 'En mantenimiento' },
  { value: 'FUERA_SERVICIO', label: 'Fuera de servicio' },
]

export const stageName = (code) => STAGES.find((stage) => stage.code === code)?.name ?? code

/** Nombres de las etapas en el orden del flujo, separados por coma (`Corte, Confección`). */
export function stagesText(codes) {
  const list = Array.isArray(codes) ? codes : []
  return STAGES.filter((stage) => list.includes(stage.code)).map((stage) => stage.name).join(', ')
}

/** Marca o desmarca una etapa y devuelve la lista en el orden del flujo, sin repetidos. */
export function toggleStage(selected, code) {
  const list = Array.isArray(selected) ? selected : []
  const next = list.includes(code) ? list.filter((item) => item !== code) : [...list, code]
  return STAGES.filter((stage) => next.includes(stage.code)).map((stage) => stage.code)
}

// --- Formularios del catálogo ---

export const emptyOperator = () => ({ nombres: '', documento: '', etapas: [], tipo_pago: 'TIEMPO' })
export const emptyMachine = () => ({
  tipo: '', marca_modelo: '', serial: '', ubicacion: '', estado: 'DISPONIBLE', etapas: [], observaciones: '',
})

/** Formulario de un operario existente, con los textos vacíos en lugar de `null`. */
export function operatorForm(operator) {
  return {
    nombres: operator.nombres, documento: operator.documento ?? '', etapas: [...operator.etapas], tipo_pago: operator.tipo_pago,
  }
}

export function machineForm(machine) {
  return {
    tipo: machine.tipo, marca_modelo: machine.marca_modelo ?? '', serial: machine.serial ?? '', ubicacion: machine.ubicacion ?? '',
    estado: machine.estado, etapas: [...machine.etapas], observaciones: machine.observaciones ?? '',
  }
}

/** Problemas del formulario del operario por campo (objeto vacío si está bien). El documento son de 5 a 15 dígitos y es opcional. */
export function operatorErrors(form) {
  const errors = {}
  if (!form.nombres.trim()) errors.nombres = 'Escribe el nombre del operario.'
  if (form.etapas.length === 0) errors.etapas = 'Marca al menos una etapa en la que pueda trabajar.'
  const document = form.documento.trim()
  if (document && !/^\d{5,15}$/.test(document)) errors.documento = 'El documento son de 5 a 15 dígitos, sin puntos.'
  return errors
}

export function machineErrors(form) {
  const errors = {}
  if (!form.tipo) errors.tipo = 'Elige el tipo de máquina.'
  if (form.etapas.length === 0) errors.etapas = 'Marca al menos una etapa en la que se use.'
  return errors
}

/** Cuerpo que se envía al servidor: textos sin espacios sobrantes. */
export function operatorPayload(form) {
  return { ...form, nombres: form.nombres.trim(), documento: form.documento.trim() }
}

export function machinePayload(form) {
  return {
    ...form, marca_modelo: form.marca_modelo.trim(), serial: form.serial.trim(), ubicacion: form.ubicacion.trim(),
    observaciones: form.observaciones.trim(),
  }
}

// --- Asignación a las etapas ---

/** Una etapa terminada ya no admite cambios de asignación. */
export const editableStage = (stage) => stage.estado !== 'COMPLETADA'

/** Operarios que se pueden asignar a la etapa: activos y habilitados para ella. */
export const eligibleOperators = (operators, stageCode) =>
  (operators ?? []).filter((operator) => operator.activo && operator.etapas.includes(stageCode))

/** Máquinas que se pueden asignar a la etapa: activas, disponibles y de uso en ella. */
export const eligibleMachines = (machines, stageCode) =>
  (machines ?? []).filter((machine) => machine.asignable && machine.etapas.includes(stageCode))

/** Aviso corto de dónde está ocupado un recurso (`Ocupado en OP-0001-L01 · Corte`), o vacío si está libre. */
export const busyText = (places) => (places?.length ? `Ocupado en ${places.join(', ')}` : '')

export const operatorLabel = (operator) => `${operator.nombres} (${operator.codigo})`
export const machineLabel = (machine) => `${machine.codigo} · ${machine.tipo_nombre}`

/**
 * Opciones del menú de operario o de máquina de una etapa. Trae los elegibles y, si la etapa ya tiene un recurso que
 * dejó de ser elegible (por ejemplo, un operario que se desactivó), también ese, para que el menú no muestre un valor vacío.
 *
 * @param {'operario'|'maquina'} kind
 * @param {Array<object>} items - catálogo cargado del servidor
 * @param {string} stageCode
 * @param {{id: number, codigo: string, nombres?: string, tipo_nombre?: string}|null} current - el recurso asignado ahora
 * @returns {Array<{id: number, label: string, busy: string, stale: boolean}>}
 */
export function pickerOptions(kind, items, stageCode, current) {
  const isOperator = kind === 'operario'
  const eligible = isOperator ? eligibleOperators(items, stageCode) : eligibleMachines(items, stageCode)
  const label = isOperator ? operatorLabel : machineLabel
  // El recurso ya asignado a esta etapa figura como ocupado por ella misma: no se avisa contra sí mismo.
  const busy = (item) => (item.id === current?.id ? '' : busyText(isOperator ? item.ocupado_en : item.ocupada_en))
  const options = eligible.map((item) => ({ id: item.id, label: label(item), busy: busy(item), stale: false }))
  if (current && !options.some((option) => option.id === current.id)) {
    const text = isOperator ? `${current.nombres} (${current.codigo})` : `${current.codigo} · ${current.tipo_nombre}`
    options.unshift({ id: current.id, label: text, busy: '', stale: true })
  }
  return options
}

/** Ids asignados ahora a la etapa, como texto para los menús (`''` si no hay). */
export function selectedIds(stage) {
  const assignment = stage.asignacion
  return { operario: assignment?.operario ? String(assignment.operario.id) : '', maquina: assignment?.maquina ? String(assignment.maquina.id) : '' }
}

/** Cuerpo de `POST /lotes/<id>/asignar/` al cambiar un menú: solo la clave que cambió; vacío quita ese recurso. */
export function assignBody(stageCode, field, value) {
  return { etapa: stageCode, [field]: value === '' ? null : Number(value) }
}

/** Texto de quién trabaja la etapa (`Ana Pérez · MAQ-0001`), o `Sin asignar`. */
export function describeAssignment(assignment) {
  if (!assignment) return 'Sin asignar'
  const parts = []
  if (assignment.operario) parts.push(assignment.operario.nombres)
  if (assignment.maquina) parts.push(assignment.maquina.codigo)
  return parts.join(' · ') || 'Sin asignar'
}

/** Una línea del historial de asignaciones: `Corte · Ana Pérez · MAQ-0001 · vigente`. */
export function historyLine(row) {
  const parts = [row.etapa_nombre]
  if (row.operario_nombre) parts.push(row.operario_nombre)
  if (row.maquina_codigo) parts.push(row.maquina_codigo)
  parts.push(row.vigente ? 'vigente' : 'cerrada')
  return parts.join(' · ')
}
