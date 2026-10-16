// Pruebas unitarias del control de tiempos por etapa. Se ejecutan con `npm test`.
import test from 'node:test'
import assert from 'node:assert/strict'
import {
  buttonsFor, countByState, formatDuration, isRunning, liveSeconds, lotLiveSeconds, replaceLot, stageProgress,
} from './lotTracking.js'

const stage = (estado, seconds = 0, running = false) => ({
  estado, tiempo_neto_segundos: seconds, en_curso_desde: running ? '2026-10-16T08:00:00Z' : null,
})
const lot = (id, estado, etapas = []) => ({ id, estado, etapas })

test('formatDuration: segundos, minutos y horas', () => {
  assert.equal(formatDuration(0), '0 s')
  assert.equal(formatDuration(45), '45 s')
  assert.equal(formatDuration(60), '1 min 00 s')
  assert.equal(formatDuration(725), '12 min 05 s')
  assert.equal(formatDuration(3600), '1 h 00 min')
  assert.equal(formatDuration(3900), '1 h 05 min')
  assert.equal(formatDuration(36000 + 59 * 60), '10 h 59 min')
})

test('formatDuration tolera valores inválidos o negativos', () => {
  for (const bad of [undefined, null, 'x', -5, NaN]) assert.equal(formatDuration(bad), '0 s')
  assert.equal(formatDuration('90'), '1 min 30 s')
})

test('liveSeconds: en pausa o terminada es el valor del servidor', () => {
  assert.equal(liveSeconds(stage('PAUSADA', 300), 1000, 999999), 300)
  assert.equal(liveSeconds(stage('COMPLETADA', 900), 1000, 999999), 900)
  assert.equal(liveSeconds(stage('PENDIENTE', 0), 1000, 5000), 0)
})

test('liveSeconds: si corre, suma lo transcurrido desde la respuesta', () => {
  assert.equal(liveSeconds(stage('EN_PROCESO', 300, true), 10_000, 17_500), 307)
  assert.equal(liveSeconds(stage('EN_PROCESO', 0, true), 10_000, 10_000), 0)
})

test('liveSeconds: un reloj atrasado no resta tiempo', () => {
  assert.equal(liveSeconds(stage('EN_PROCESO', 300, true), 10_000, 5_000), 300)
})

test('lotLiveSeconds suma todas las etapas del lote', () => {
  const current = lot(1, 'EN_PROCESO', [stage('COMPLETADA', 600), stage('EN_PROCESO', 60, true), stage('PENDIENTE')])
  assert.equal(lotLiveSeconds(current, 0, 30_000), 600 + 60 + 30)
})

test('isRunning solo si alguna etapa corre', () => {
  assert.equal(isRunning(lot(1, 'EN_PROCESO', [stage('EN_PROCESO', 0, true)])), true)
  assert.equal(isRunning(lot(1, 'EN_PAUSA', [stage('PAUSADA', 10)])), false)
  assert.equal(isRunning(lot(1, 'PLANEADA', [stage('PENDIENTE')])), false)
})

test('stageProgress cuenta las etapas terminadas', () => {
  const current = lot(1, 'EN_PROCESO', [stage('COMPLETADA'), stage('COMPLETADA'), stage('EN_PROCESO'), stage('PENDIENTE')])
  assert.deepEqual(stageProgress(current), { done: 2, total: 4 })
})

test('buttonsFor habilita solo las acciones que admite el lote', () => {
  const enabled = (actions) => buttonsFor(actions).filter((b) => b.enabled).map((b) => b.id)
  assert.deepEqual(enabled(['iniciar']), ['iniciar'])
  assert.deepEqual(enabled(['pausar', 'completar']), ['pausar', 'completar'])
  assert.deepEqual(enabled(['reanudar', 'completar']), ['reanudar', 'completar'])
  assert.deepEqual(enabled([]), [])
  assert.equal(buttonsFor([]).length, 4)
})

test('replaceLot cambia solo el lote indicado y no modifica la orden original', () => {
  const order = { id: 9, lotes: [lot(1, 'PLANEADA'), lot(2, 'PLANEADA')] }
  const updated = replaceLot(order, lot(2, 'EN_PROCESO'))
  assert.deepEqual(updated.lotes.map((l) => l.estado), ['PLANEADA', 'EN_PROCESO'])
  assert.equal(order.lotes[1].estado, 'PLANEADA')
  assert.equal(updated.id, 9)
})

test('countByState agrupa los lotes por estado', () => {
  assert.deepEqual(countByState([lot(1, 'PLANEADA'), lot(2, 'EN_PROCESO'), lot(3, 'PLANEADA')]), { PLANEADA: 2, EN_PROCESO: 1 })
  assert.deepEqual(countByState([]), {})
})
