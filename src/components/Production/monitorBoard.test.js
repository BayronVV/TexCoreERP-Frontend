// Pruebas unitarias del monitor de estado. Se ejecutan con `npm test`.
import test from 'node:test'
import assert from 'node:assert/strict'
import {
  COLUMN_STATES, alertInfo, alertSummary, ageLabel, boardQuery, boardTotal, canDrop, cardButtons, dropOutcome, hiddenCount, moveLot, refreshLabel,
  targetOfAction,
} from './monitorBoard.js'

const lot = (estado, acciones, extra = {}) => ({ id: 1, estado, acciones, termina_el_lote: false, ...extra })
const planned = lot('PLANEADA', ['iniciar'])
const running = lot('EN_PROCESO', ['pausar', 'completar'])
const between = lot('EN_PROCESO', ['iniciar'])
const paused = lot('EN_PAUSA', ['reanudar', 'completar'])
const lastRunning = lot('EN_PROCESO', ['pausar', 'completar'], { termina_el_lote: true })
const lastPaused = lot('EN_PAUSA', ['reanudar', 'completar'], { termina_el_lote: true })
const done = lot('TERMINADA', [])

test('las columnas son las cuatro del tablero, en orden', () => {
  assert.deepEqual(COLUMN_STATES, ['PLANEADA', 'EN_PROCESO', 'EN_PAUSA', 'TERMINADA'])
})

test('soltar donde ya estaba no hace nada', () => {
  for (const [card, state] of [[planned, 'PLANEADA'], [running, 'EN_PROCESO'], [paused, 'EN_PAUSA'], [done, 'TERMINADA']]) {
    assert.deepEqual(dropOutcome(card, state), { noop: true })
  }
})

test('a En proceso: iniciar desde Planeada o entre etapas, reanudar desde En pausa', () => {
  assert.deepEqual(dropOutcome(planned, 'EN_PROCESO'), { action: 'iniciar' })
  assert.deepEqual(dropOutcome(paused, 'EN_PROCESO'), { action: 'reanudar' })
  assert.deepEqual(dropOutcome(lot('EN_PAUSA', ['reanudar', 'completar']), 'EN_PROCESO'), { action: 'reanudar' })
})

test('a En pausa: solo desde un lote con una etapa en marcha', () => {
  assert.deepEqual(dropOutcome(running, 'EN_PAUSA'), { action: 'pausar' })
  assert.match(dropOutcome(planned, 'EN_PAUSA').reason, /etapa en marcha/)
  assert.match(dropOutcome(between, 'EN_PAUSA').reason, /etapa en marcha/)
})

test('a Terminada: solo si terminar la etapa en curso deja el lote terminado', () => {
  assert.deepEqual(dropOutcome(lastRunning, 'TERMINADA'), { action: 'completar' })
  assert.deepEqual(dropOutcome(lastPaused, 'TERMINADA'), { action: 'completar' })
  assert.match(dropOutcome(running, 'TERMINADA').reason, /última etapa/)
  assert.match(dropOutcome(planned, 'TERMINADA').reason, /última etapa/)
  assert.match(dropOutcome(paused, 'TERMINADA').reason, /última etapa/)
})

test('nunca se vuelve a Planeada ni se mueve un lote terminado', () => {
  for (const card of [running, paused, between]) assert.match(dropOutcome(card, 'PLANEADA').reason, /no vuelve a Planeada/)
  for (const state of ['PLANEADA', 'EN_PROCESO', 'EN_PAUSA']) assert.match(dropOutcome(done, state).reason, /terminado/)
})

test('canDrop solo es cierto cuando hay una acción que pedir', () => {
  assert.equal(canDrop(planned, 'EN_PROCESO'), true)
  assert.equal(canDrop(planned, 'EN_PAUSA'), false)
  assert.equal(canDrop(planned, 'PLANEADA'), false) // donde ya está no cuenta como destino válido
  assert.equal(canDrop(done, 'EN_PROCESO'), false)
  assert.equal(canDrop(lastRunning, 'TERMINADA'), true)
})

test('cardButtons ofrece solo las acciones que el lote admite', () => {
  assert.deepEqual(cardButtons(planned).map((b) => b.id), ['iniciar'])
  assert.deepEqual(cardButtons(running).map((b) => b.id), ['pausar', 'completar'])
  assert.deepEqual(cardButtons(paused).map((b) => b.id), ['reanudar', 'completar'])
  assert.deepEqual(cardButtons(done), [])
})

const board = () => [
  { estado: 'PLANEADA', total: 2, lotes: [{ id: 1, estado: 'PLANEADA' }, { id: 2, estado: 'PLANEADA' }] },
  { estado: 'EN_PROCESO', total: 1, lotes: [{ id: 3, estado: 'EN_PROCESO' }] },
  { estado: 'EN_PAUSA', total: 0, lotes: [] },
  { estado: 'TERMINADA', total: 0, lotes: [] },
]

test('moveLot cambia la tarjeta de columna y ajusta los totales', () => {
  const moved = moveLot(board(), 1, 'EN_PROCESO')
  assert.deepEqual(moved.map((c) => c.total), [1, 2, 0, 0])
  assert.deepEqual(moved[1].lotes.map((l) => [l.id, l.estado]), [[1, 'EN_PROCESO'], [3, 'EN_PROCESO']])
  assert.deepEqual(moved[0].lotes.map((l) => l.id), [2])
})

test('moveLot no modifica el tablero original ni falla con un lote que no existe', () => {
  const original = board()
  moveLot(original, 1, 'EN_PAUSA')
  assert.deepEqual(original, board())
  assert.equal(moveLot(original, 99, 'EN_PAUSA'), original)
})

test('moveLot a la misma columna deja todo igual', () => {
  assert.deepEqual(moveLot(board(), 3, 'EN_PROCESO').map((c) => c.total), [2, 1, 0, 0])
})

test('ageLabel: segundos, minutos, horas y días', () => {
  const now = new Date('2026-10-16T12:00:00Z').getTime()
  const ago = (seconds) => new Date(now - seconds * 1000).toISOString()
  assert.equal(ageLabel(ago(5), now), 'hace 5 s')
  assert.equal(ageLabel(ago(90), now), 'hace 1 min')
  assert.equal(ageLabel(ago(3 * 3600 + 120), now), 'hace 3 h')
  assert.equal(ageLabel(ago(2 * 86400 + 50), now), 'hace 2 d')
  assert.equal(ageLabel(null, now), '')
  assert.equal(ageLabel(ago(-30), now), 'hace 0 s') // un reloj adelantado no da tiempos negativos
})

test('refreshLabel', () => {
  const now = new Date('2026-10-16T12:00:30Z').getTime()
  assert.equal(refreshLabel('2026-10-16T12:00:00Z', now), 'Actualizado hace 30 s')
  assert.equal(refreshLabel(null, now), 'Cargando…')
})

test('hiddenCount y boardTotal', () => {
  assert.equal(hiddenCount({ total: 120, lotes: new Array(50) }), 70)
  assert.equal(hiddenCount({ total: 3, lotes: new Array(3) }), 0)
  assert.equal(hiddenCount({ total: 1, lotes: new Array(2) }), 0)
  assert.equal(boardTotal(board()), 3)
})

test('boardQuery arma solo los filtros elegidos', () => {
  assert.equal(boardQuery(), '')
  assert.equal(boardQuery({ orden: '4' }), '?orden=4')
  assert.equal(boardQuery({ orden: '4', referencia: '9', limite: '100' }), '?orden=4&referencia=9&limite=100')
  assert.equal(boardQuery({ orden: '', referencia: '9' }), '?referencia=9')
})

test('targetOfAction: columna a la que va la tarjeta tras cada acción', () => {
  assert.equal(targetOfAction(planned, 'iniciar'), 'EN_PROCESO')
  assert.equal(targetOfAction(paused, 'reanudar'), 'EN_PROCESO')
  assert.equal(targetOfAction(running, 'pausar'), 'EN_PAUSA')
  assert.equal(targetOfAction(lastRunning, 'completar'), 'TERMINADA')
  assert.equal(targetOfAction(running, 'completar'), null) // la etapa termina, pero el lote sigue en proceso
  assert.equal(targetOfAction(running, 'volar'), null)
})

test('un lote de una orden anulada no se mueve ni se puede llevar a Cancelada arrastrando', () => {
  const cancelled = lot('CANCELADA', [])
  assert.match(dropOutcome(cancelled, 'EN_PROCESO').reason, /orden anulada/)
  assert.match(dropOutcome(running, 'CANCELADA').reason, /anulándola/)
  assert.equal(canDrop(cancelled, 'EN_PROCESO'), false)
  assert.equal(canDrop(running, 'CANCELADA'), false)
  assert.deepEqual(dropOutcome(cancelled, 'CANCELADA'), { noop: true })
})

test('alertInfo: sin alerta no hay aviso', () => {
  assert.equal(alertInfo({ alerta: null, estado: 'EN_PAUSA', espera_segundos: 5000 }, 0, 0), null)
})

test('alertInfo: texto según el estado y el nivel que dice el servidor', () => {
  const paused = { alerta: 'CRITICA', estado: 'EN_PAUSA', espera_segundos: 9 * 3600 }
  assert.deepEqual(alertInfo(paused, 0, 0), { level: 'CRITICA', label: 'Crítica', text: 'En pausa hace 9 h 00 min' })
  const between = { alerta: 'ATENCION', estado: 'EN_PROCESO', espera_segundos: 3 * 3600 + 120 }
  assert.deepEqual(alertInfo(between, 0, 0), { level: 'ATENCION', label: 'Atención', text: 'Esperando la siguiente etapa hace 3 h 02 min' })
})

test('alertInfo: la espera sigue corriendo desde que llegaron los datos', () => {
  const paused = { alerta: 'ATENCION', estado: 'EN_PAUSA', espera_segundos: 2 * 3600 }
  assert.equal(alertInfo(paused, 10_000, 10_000 + 60_000).text, 'En pausa hace 2 h 01 min')
  assert.equal(alertInfo(paused, 10_000, 5_000).text, 'En pausa hace 2 h 00 min') // un reloj atrasado no resta
})

test('alertSummary escribe solo lo que hay', () => {
  assert.equal(alertSummary({ atencion: 0, critica: 0 }), '')
  assert.equal(alertSummary(undefined), '')
  assert.equal(alertSummary({ atencion: 1, critica: 0 }), '1 lote con atención')
  assert.equal(alertSummary({ atencion: 3, critica: 0 }), '3 lotes con atención')
  assert.equal(alertSummary({ atencion: 0, critica: 1 }), '1 lote con alerta crítica')
  assert.equal(alertSummary({ atencion: 2, critica: 2 }), '2 lotes con alerta crítica · 2 con atención')
})

test('boardQuery incluye las canceladas solo si se piden', () => {
  assert.equal(boardQuery({ canceladas: true }), '?canceladas=1')
  assert.equal(boardQuery({ canceladas: false }), '')
  assert.equal(boardQuery({ orden: '4', canceladas: true }), '?orden=4&canceladas=1')
})
