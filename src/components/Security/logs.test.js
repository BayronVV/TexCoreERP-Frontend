import test from 'node:test'
import assert from 'node:assert/strict'
import { actionLabel, buildLogQuery, resultTone } from './logs.js'

test('buildLogQuery omite los filtros vacíos y agrega la página', () => {
  assert.equal(buildLogQuery({ q: '', result: '' }), '')
  assert.equal(buildLogQuery({ q: ' ana ', result: 'fallido', date_from: '2026-11-01' }), '?q=ana&result=fallido&date_from=2026-11-01')
  assert.equal(buildLogQuery({ result: 'fallido' }, 3), '?result=fallido&page=3')
  assert.equal(buildLogQuery({ result: 'fallido' }, 1), '?result=fallido')
})

test('actionLabel vuelve legible el código de la acción', () => {
  assert.equal(actionLabel('factura.anular'), 'Factura · anular')
  assert.equal(actionLabel('orden_produccion.crear'), 'Orden produccion · crear')
  assert.equal(actionLabel('sinpunto'), 'sinpunto')
})

test('resultTone distingue éxito, fallo y bloqueo', () => {
  assert.equal(resultTone('exito'), 'on')
  assert.equal(resultTone('exitoso'), 'on')
  assert.equal(resultTone('error'), 'off')
  assert.equal(resultTone('fallido'), 'off')
  assert.equal(resultTone('rechazado'), 'warn')
  assert.equal(resultTone('bloqueado'), 'warn')
})
