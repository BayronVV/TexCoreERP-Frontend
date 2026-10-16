// Pruebas unitarias de la planificación de producción (lotes y bloqueo de la orden). Se ejecutan con `npm test`.
import test from 'node:test'
import assert from 'node:assert/strict'
import {
  MAX_GARMENTS, MAX_LOTS, buildSimulationBody, lotProblems, lotsReady, lotsSum, planProblems, splitEvenly,
} from './lotSplit.js'

test('splitEvenly reparte parejo y el resto va a los primeros lotes', () => {
  assert.deepEqual(splitEvenly(10, 3), [4, 3, 3])
  assert.deepEqual(splitEvenly(100, 4), [25, 25, 25, 25])
  assert.deepEqual(splitEvenly('7', '2'), [4, 3])
  assert.deepEqual(splitEvenly(11, 4), [3, 3, 3, 2])
})

test('splitEvenly: un lote, y tantos lotes como prendas', () => {
  assert.deepEqual(splitEvenly(5, 1), [5])
  assert.deepEqual(splitEvenly(4, 4), [1, 1, 1, 1])
})

test('splitEvenly siempre suma el total', () => {
  for (const [total, count] of [[1, 1], [97, 7], [1000, 33], [50, 50], [123456, 50]]) {
    assert.equal(lotsSum(splitEvenly(total, count)), total, `${total}/${count}`)
  }
})

test('splitEvenly devuelve vacío con datos inválidos', () => {
  for (const [total, count] of [[10, 0], [10, -1], [10, 1.5], ['abc', 2], [10, 'x'], ['', 2], [10, ''], [0, 1], [3, 4], [100, MAX_LOTS + 1]]) {
    assert.deepEqual(splitEvenly(total, count), [], `${total}/${count}`)
  }
  assert.deepEqual(splitEvenly(MAX_LOTS, MAX_LOTS).length, MAX_LOTS)
})

test('lotsSum solo cuenta enteros positivos', () => {
  assert.equal(lotsSum(['50', '25']), 75)
  assert.equal(lotsSum(['50', '', 'abc', '1.5', '-3', '0']), 50)
  assert.equal(lotsSum([]), 0)
})

test('lotProblems: sin lotes no hay problema (el total no se divide)', () => {
  assert.deepEqual(lotProblems([], 100), [])
})

test('lotProblems: la suma exacta no tiene problemas', () => {
  assert.deepEqual(lotProblems(['60', '40'], '100'), [])
  assert.deepEqual(lotProblems(['100'], 100), [])
})

test('lotProblems dice cuántas prendas faltan o sobran', () => {
  assert.deepEqual(lotProblems(['60', '30'], 100), ['Faltan 10 prendas por asignar a un lote.'])
  assert.deepEqual(lotProblems(['60', '60'], 100), ['Sobran 20 prendas: los lotes suman más que el total.'])
})

test('lotProblems señala los lotes inválidos por su número', () => {
  assert.deepEqual(lotProblems(['50', '', '0', '1.5'], 100), ['Revisa el lote 2, 3, 4: debe ser un número entero mayor que cero.'])
  assert.deepEqual(lotProblems(['50', '-5'], 100), ['Revisa el lote 2: debe ser un número entero mayor que cero.'])
})

test('lotProblems no compara con un total inválido', () => {
  assert.deepEqual(lotProblems(['50', '50'], ''), [])
})

test('lotProblems limita el número de lotes', () => {
  const sizes = Array.from({ length: MAX_LOTS + 1 }, () => '1')
  assert.ok(lotProblems(sizes, MAX_LOTS + 1).includes(`Máximo ${MAX_LOTS} lotes.`))
})

test('lotsReady: hay lotes y están bien repartidos', () => {
  assert.equal(lotsReady(['60', '40'], 100), true)
  assert.equal(lotsReady([], 100), false)
  assert.equal(lotsReady(['60', '30'], 100), false)
})

test('buildSimulationBody envía los lotes solo si están completos', () => {
  assert.deepEqual(buildSimulationBody({ referencia: '4', total: '100', sizes: ['60', '40'] }), {
    referencia: 4, cantidad: 100, lotes: [60, 40],
  })
  assert.deepEqual(buildSimulationBody({ referencia: '4', total: '100', sizes: [] }), { referencia: 4, cantidad: 100 })
  assert.deepEqual(buildSimulationBody({ referencia: '4', total: '100', sizes: ['60', '30'] }), { referencia: 4, cantidad: 100 })
})

const REFERENCE = { id: 4, tiene_ficha: true }
const VIABLE = { loading: false, error: '', data: { cantidad: 100, viable: true, faltantes: [], lotes: null } }
const state = (over = {}) => ({ reference: REFERENCE, total: '100', sizes: [], plan: VIABLE, ...over })

test('planProblems: con todo listo y material suficiente se puede crear la orden', () => {
  assert.deepEqual(planProblems(state()), [])
})

test('planProblems exige referencia, ficha y total', () => {
  assert.deepEqual(planProblems(state({ reference: undefined })), ['Elige la referencia.'])
  assert.deepEqual(planProblems(state({ reference: { id: 5, tiene_ficha: false } })), ['La referencia no tiene ficha técnica.'])
  for (const total of ['', '0', '-3', '1.5', 'abc']) {
    assert.deepEqual(planProblems(state({ total })), ['Indica cuántas prendas se van a producir.'], total)
  }
  assert.deepEqual(planProblems(state({ total: String(MAX_GARMENTS + 1) })), [`Máximo ${MAX_GARMENTS} prendas.`])
})

test('planProblems bloquea si los lotes no suman el total', () => {
  assert.deepEqual(planProblems(state({ sizes: ['60', '30'] })), ['Faltan 10 prendas por asignar a un lote.'])
})

test('planProblems bloquea y nombra el material que falta', () => {
  const plan = { ...VIABLE, data: { cantidad: 100, viable: false, faltantes: [{ nombre: 'Botón' }, { nombre: 'Denim' }], lotes: null } }
  assert.deepEqual(planProblems(state({ plan })), ['Falta material: Botón, Denim.'])
})

test('planProblems bloquea mientras calcula y con un resultado de otra cantidad', () => {
  const wait = ['Calculando la disponibilidad de material…']
  assert.deepEqual(planProblems(state({ plan: { ...VIABLE, loading: true } })), wait)
  assert.deepEqual(planProblems(state({ plan: { loading: false, error: '', data: null } })), wait)
  assert.deepEqual(planProblems(state({ total: '150' })), wait) // el resultado es de 100 prendas
})

test('planProblems espera el resultado con lotes cuando se dividió', () => {
  const wait = ['Calculando la disponibilidad de material…']
  assert.deepEqual(planProblems(state({ sizes: ['60', '40'] })), wait) // el resultado aún no trae lotes
  const withLots = { ...VIABLE, data: { ...VIABLE.data, lotes: [{ numero: 1 }, { numero: 2 }] } }
  assert.deepEqual(planProblems(state({ sizes: ['60', '40'], plan: withLots })), [])
})

test('planProblems muestra el error del servidor y lo prioriza sobre el resultado', () => {
  const plan = { loading: false, error: 'La referencia no tiene ficha técnica.', data: VIABLE.data }
  assert.deepEqual(planProblems(state({ plan })), ['La referencia no tiene ficha técnica.'])
})
