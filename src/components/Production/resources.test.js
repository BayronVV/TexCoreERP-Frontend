import test from 'node:test'
import assert from 'node:assert/strict'

import {
  assignBody,
  busyText,
  describeAssignment,
  editableStage,
  eligibleMachines,
  eligibleOperators,
  emptyMachine,
  emptyOperator,
  historyLine,
  machineErrors,
  machineForm,
  machinePayload,
  operatorErrors,
  operatorForm,
  operatorPayload,
  pickerOptions,
  selectedIds,
  stageName,
  stagesText,
  toggleStage,
} from './resources.js'

const ana = { id: 1, codigo: 'OPE-0001', nombres: 'Ana Pérez', activo: true, etapas: ['CORTE', 'CONFECCION'], ocupado_en: [] }
const luis = { id: 2, codigo: 'OPE-0002', nombres: 'Luis Gómez', activo: true, etapas: ['CONFECCION'], ocupado_en: ['OP-0001-L02 · Confección'] }
const inactive = { id: 3, codigo: 'OPE-0003', nombres: 'Sin Turno', activo: false, etapas: ['CORTE'], ocupado_en: [] }
const cutter = { id: 10, codigo: 'MAQ-0001', tipo_nombre: 'Cortadora de tela', asignable: true, etapas: ['CORTE'], ocupada_en: [] }
const plana = { id: 11, codigo: 'MAQ-0002', tipo_nombre: 'Plana de una aguja', asignable: true, etapas: ['CONFECCION'], ocupada_en: ['OP-0001-L01 · Confección'] }
const broken = { id: 12, codigo: 'MAQ-0003', tipo_nombre: 'Fileteadora', asignable: false, etapas: ['CONFECCION'], ocupada_en: [] }

test('stageName y stagesText: nombres legibles y en el orden del flujo', () => {
  assert.equal(stageName('CONFECCION'), 'Confección')
  assert.equal(stageName('OTRA'), 'OTRA')
  assert.equal(stagesText(['TERMINACION', 'CORTE']), 'Corte, Terminación')
  assert.equal(stagesText([]), '')
  assert.equal(stagesText(undefined), '')
})

test('toggleStage: marca y desmarca sin perder el orden del flujo', () => {
  assert.deepEqual(toggleStage([], 'TERMINACION'), ['TERMINACION'])
  assert.deepEqual(toggleStage(['TERMINACION'], 'CORTE'), ['CORTE', 'TERMINACION'])
  assert.deepEqual(toggleStage(['CORTE', 'TERMINACION'], 'CORTE'), ['TERMINACION'])
  assert.deepEqual(toggleStage(undefined, 'CORTE'), ['CORTE'])
})

test('operatorErrors: pide nombre y etapa, y valida el documento solo si se escribe', () => {
  assert.deepEqual(Object.keys(operatorErrors(emptyOperator())).sort(), ['etapas', 'nombres'])
  const valid = { ...emptyOperator(), nombres: 'Ana', etapas: ['CORTE'] }
  assert.deepEqual(operatorErrors(valid), {})
  assert.deepEqual(operatorErrors({ ...valid, documento: '1090123456' }), {})
  assert.ok(operatorErrors({ ...valid, documento: '12ab' }).documento)
  assert.ok(operatorErrors({ ...valid, documento: '1234' }).documento)
  assert.ok(operatorErrors({ ...valid, documento: '1.090.123.456' }).documento)
  assert.ok(operatorErrors({ ...valid, nombres: '   ' }).nombres)
})

test('machineErrors: pide tipo y al menos una etapa', () => {
  assert.deepEqual(Object.keys(machineErrors(emptyMachine())).sort(), ['etapas', 'tipo'])
  assert.deepEqual(machineErrors({ ...emptyMachine(), tipo: 'PLANA', etapas: ['CONFECCION'] }), {})
})

test('operatorPayload y machinePayload: quitan los espacios sobrantes', () => {
  assert.equal(operatorPayload({ ...emptyOperator(), nombres: '  Ana  ', documento: ' 1090123456 ' }).nombres, 'Ana')
  assert.equal(operatorPayload({ ...emptyOperator(), documento: ' 1090123456 ' }).documento, '1090123456')
  const payload = machinePayload({ ...emptyMachine(), marca_modelo: ' Juki ', serial: ' S1 ', ubicacion: ' Línea 1 ', observaciones: ' ok ' })
  assert.deepEqual([payload.marca_modelo, payload.serial, payload.ubicacion, payload.observaciones], ['Juki', 'S1', 'Línea 1', 'ok'])
})

test('operatorForm y machineForm: copian el registro con textos vacíos en lugar de null', () => {
  const form = operatorForm({ nombres: 'Ana', documento: null, etapas: ['CORTE'], tipo_pago: 'PIEZA' })
  assert.deepEqual(form, { nombres: 'Ana', documento: '', etapas: ['CORTE'], tipo_pago: 'PIEZA' })
  const machine = machineForm({ tipo: 'PLANA', marca_modelo: null, serial: '', ubicacion: null, estado: 'DISPONIBLE', etapas: ['CONFECCION'], observaciones: null })
  assert.equal(machine.marca_modelo, '')
  assert.equal(machine.ubicacion, '')
  assert.equal(machine.observaciones, '')
})

test('editableStage: una etapa terminada ya no se puede cambiar', () => {
  assert.equal(editableStage({ estado: 'PENDIENTE' }), true)
  assert.equal(editableStage({ estado: 'EN_PROCESO' }), true)
  assert.equal(editableStage({ estado: 'PAUSADA' }), true)
  assert.equal(editableStage({ estado: 'COMPLETADA' }), false)
})

test('eligibleOperators y eligibleMachines: solo lo que se puede asignar a la etapa', () => {
  const operators = [ana, luis, inactive]
  assert.deepEqual(eligibleOperators(operators, 'CORTE').map((o) => o.id), [1])
  assert.deepEqual(eligibleOperators(operators, 'CONFECCION').map((o) => o.id), [1, 2])
  assert.deepEqual(eligibleOperators(operators, 'TERMINACION'), [])
  const machines = [cutter, plana, broken]
  assert.deepEqual(eligibleMachines(machines, 'CORTE').map((m) => m.id), [10])
  assert.deepEqual(eligibleMachines(machines, 'CONFECCION').map((m) => m.id), [11]) // la dañada no
  assert.deepEqual(eligibleOperators(undefined, 'CORTE'), [])
})

test('busyText: avisa dónde está ocupado un recurso', () => {
  assert.equal(busyText([]), '')
  assert.equal(busyText(undefined), '')
  assert.equal(busyText(['OP-0001-L01 · Corte']), 'Ocupado en OP-0001-L01 · Corte')
  assert.equal(busyText(['A', 'B']), 'Ocupado en A, B')
})

test('pickerOptions: opciones elegibles con su aviso de ocupación', () => {
  const options = pickerOptions('operario', [ana, luis, inactive], 'CONFECCION', null)
  assert.deepEqual(options.map((o) => o.label), ['Ana Pérez (OPE-0001)', 'Luis Gómez (OPE-0002)'])
  assert.equal(options[1].busy, 'Ocupado en OP-0001-L02 · Confección')
  assert.equal(options[0].busy, '')
  const machines = pickerOptions('maquina', [cutter, plana, broken], 'CONFECCION', null)
  assert.deepEqual(machines.map((o) => o.label), ['MAQ-0002 · Plana de una aguja'])
})

test('pickerOptions: el recurso ya asignado a la etapa no se avisa como ocupado por ella misma', () => {
  const busyLuis = { ...luis, ocupado_en: ['OP-0001-L02 · Confección'] }
  const options = pickerOptions('operario', [ana, busyLuis], 'CONFECCION', { id: 2, codigo: 'OPE-0002', nombres: 'Luis Gómez' })
  assert.equal(options.find((o) => o.id === 2).busy, '')
  const other = pickerOptions('operario', [ana, busyLuis], 'CONFECCION', null)
  assert.equal(other.find((o) => o.id === 2).busy, 'Ocupado en OP-0001-L02 · Confección')
})

test('pickerOptions: conserva el recurso asignado aunque ya no sea elegible', () => {
  const options = pickerOptions('operario', [ana, inactive], 'CORTE', { id: 3, codigo: 'OPE-0003', nombres: 'Sin Turno' })
  assert.equal(options[0].id, 3)
  assert.equal(options[0].stale, true)
  assert.equal(options.length, 2)
  // si sigue siendo elegible no se duplica
  const same = pickerOptions('operario', [ana], 'CORTE', { id: 1, codigo: 'OPE-0001', nombres: 'Ana Pérez' })
  assert.equal(same.length, 1)
  assert.equal(same[0].stale, false)
  const machine = pickerOptions('maquina', [], 'CORTE', { id: 12, codigo: 'MAQ-0003', tipo_nombre: 'Fileteadora' })
  assert.equal(machine[0].label, 'MAQ-0003 · Fileteadora')
})

test('selectedIds: los ids asignados como texto para los menús', () => {
  assert.deepEqual(selectedIds({ asignacion: null }), { operario: '', maquina: '' })
  assert.deepEqual(selectedIds({}), { operario: '', maquina: '' })
  assert.deepEqual(
    selectedIds({ asignacion: { operario: { id: 7 }, maquina: null } }),
    { operario: '7', maquina: '' },
  )
})

test('assignBody: solo envía la clave que cambió; vacío la quita', () => {
  assert.deepEqual(assignBody('CORTE', 'operario', '5'), { etapa: 'CORTE', operario: 5 })
  assert.deepEqual(assignBody('CONFECCION', 'maquina', ''), { etapa: 'CONFECCION', maquina: null })
})

test('describeAssignment e historyLine: textos para mostrar', () => {
  assert.equal(describeAssignment(null), 'Sin asignar')
  assert.equal(describeAssignment({ operario: null, maquina: null }), 'Sin asignar')
  assert.equal(describeAssignment({ operario: { nombres: 'Ana' }, maquina: { codigo: 'MAQ-0001' } }), 'Ana · MAQ-0001')
  assert.equal(describeAssignment({ operario: { nombres: 'Ana' }, maquina: null }), 'Ana')
  assert.equal(historyLine({ etapa_nombre: 'Corte', operario_nombre: 'Ana', maquina_codigo: 'MAQ-0001', vigente: true }), 'Corte · Ana · MAQ-0001 · vigente')
  assert.equal(historyLine({ etapa_nombre: 'Corte', operario_nombre: '', maquina_codigo: 'MAQ-0001', vigente: false }), 'Corte · MAQ-0001 · cerrada')
})
