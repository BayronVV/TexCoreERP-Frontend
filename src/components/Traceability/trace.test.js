import assert from 'node:assert/strict'
import { test } from 'node:test'

import { differenceText, formatDuration, searchMessage, stepStatus, tracePath, TRACE_PERMISSIONS } from './trace.js'

test('la ruta de la ficha depende del tipo y codifica el código', () => {
  assert.equal(tracePath('lote', 'OP-0007-L01'), '/trazabilidad/lote/OP-0007-L01')
  assert.equal(tracePath('factura', 'FV-0009'), '/trazabilidad/factura/FV-0009')
  assert.equal(tracePath('factura', 'A B'), '/trazabilidad/factura/A%20B')
  assert.equal(tracePath('lote', ''), '/trazabilidad')
})

test('los permisos de la pantalla son solo de consulta', () => {
  assert.ok(TRACE_PERMISSIONS.every((code) => code.endsWith('.ver')))
  assert.ok(TRACE_PERMISSIONS.includes('ventas.ver') && TRACE_PERMISSIONS.includes('produccion.ver'))
})

test('estado de cada paso de la conciliación', () => {
  assert.equal(stepStatus({ acceso: false }), 'sin-acceso')
  assert.equal(stepStatus({ acceso: true, pendiente: true, cantidad: null }), 'pendiente')
  assert.equal(stepStatus({ acceso: true, pendiente: false, cantidad: 30 }), 'ok')
  assert.equal(stepStatus({ acceso: true, pendiente: false, cantidad: 27, diferencia: 3, justificada: 3, sin_justificar: 0 }), 'ok')
  assert.equal(stepStatus({ acceso: true, pendiente: false, cantidad: 26, diferencia: 4, justificada: 3, sin_justificar: 1 }), 'alerta')
  assert.equal(stepStatus({ acceso: true, pendiente: false, cantidad: 25, diferencia: -1, justificada: 0, sin_justificar: -1 }), 'alerta')
})

test('texto de la diferencia', () => {
  assert.equal(differenceText({}), '')
  assert.equal(differenceText({ diferencia: 0, porcentaje: 0, justificada: 0, sin_justificar: 0 }), 'Cuadra con el paso anterior')
  assert.equal(differenceText({ diferencia: 3, porcentaje: 12.5, justificada: 3, sin_justificar: 0 }), '−3 (12,5 %), justificadas por lo registrado')
  assert.equal(differenceText({ diferencia: 4, porcentaje: 13.3, justificada: 0, sin_justificar: 4 }), '−4 (13,3 %) sin justificar')
  assert.equal(differenceText({ diferencia: 4, porcentaje: 13.3, justificada: 3, sin_justificar: 1 }), '−4 (13,3 %): 3 justificadas y 1 sin justificar')
  assert.equal(differenceText({ diferencia: -1, porcentaje: -4.2, justificada: 0, sin_justificar: -1 }), '1 más que el paso anterior: sin justificar')
})

test('duración legible', () => {
  assert.equal(formatDuration(0), '—')
  assert.equal(formatDuration(2700), '45 min')
  assert.equal(formatDuration(7500), '2 h 05 min')
})

test('mensajes de la búsqueda', () => {
  assert.equal(searchMessage({ tipo: null, codigo: 'XX-1' }), 'No encontramos ningún registro con el código «XX-1».')
  assert.equal(searchMessage({ tipo: 'orden', codigo: 'OP-0007', opciones: [{}, {}, {}] }), 'La orden OP-0007 tiene 3 lotes: elige uno.')
  assert.equal(searchMessage({ tipo: 'relacion', codigo: 'RD-0001', opciones: [] }), 'La relación RD-0001 no tiene guías.')
  assert.equal(searchMessage({ tipo: 'lote', codigo: 'OP-0007-L01' }), '')
})
