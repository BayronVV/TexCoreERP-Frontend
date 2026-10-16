// Pruebas unitarias de la lógica pura de la cesta de una orden. Se ejecutan con `npm test`.
import test from 'node:test'
import assert from 'node:assert/strict'
import {
  applyPlan, buildOrderBody, isPositiveInteger, isShort, orderProblems, stepFor, withoutPlan,
} from './orderLines.js'

const PRODUCTS = {
  1: { id: 1, tipo: 'MATERIA_PRIMA', unidad: 'm', stock_actual: '500.00' },
  2: { id: 2, tipo: 'INSUMO', unidad: 'unidad', stock_actual: '300.00' },
  3: { id: 3, tipo: 'GENERICO', unidad: 'unidad', stock_actual: '100.00' },
}
const productOf = (id) => PRODUCTS[id]

test('stepFor: entero para piezas y centésimas para el resto', () => {
  assert.equal(stepFor('unidad'), '1')
  assert.equal(stepFor('rollo'), '1')
  assert.equal(stepFor('caja'), '1')
  assert.equal(stepFor('m'), '0.01')
  assert.equal(stepFor('kg'), '0.01')
  assert.equal(stepFor(undefined), '0.01')
})

test('isPositiveInteger acepta solo enteros positivos', () => {
  for (const ok of ['1', '250', ' 12 ', 7]) assert.equal(isPositiveInteger(ok), true, String(ok))
  for (const bad of ['', '0', '-3', '1.5', 'abc', null, undefined, '1e3']) assert.equal(isPositiveInteger(bad), false, String(bad))
})

test('applyPlan coloca los materiales de la ficha y marca su origen', () => {
  const result = applyPlan([], [{ producto: 1, requerido: '165.00' }, { producto: 2, requerido: '100' }])
  assert.deepEqual(result, [
    { producto: 1, cantidad: '165.00', desdeFicha: true },
    { producto: 2, cantidad: '100', desdeFicha: true },
  ])
})

test('applyPlan reemplaza lo que venía de una ficha anterior', () => {
  const before = [{ producto: 1, cantidad: '165.00', desdeFicha: true }, { producto: 2, cantidad: '100', desdeFicha: true }]
  const result = applyPlan(before, [{ producto: 1, requerido: '330.00' }])
  assert.deepEqual(result, [{ producto: 1, cantidad: '330.00', desdeFicha: true }])
})

test('applyPlan conserva lo agregado a mano', () => {
  const before = [{ producto: 3, cantidad: '20' }]
  const result = applyPlan(before, [{ producto: 1, requerido: '10.00' }])
  assert.deepEqual(result, [{ producto: 1, cantidad: '10.00', desdeFicha: true }, { producto: 3, cantidad: '20' }])
})

test('applyPlan no duplica un producto que la ficha también trae: manda la ficha', () => {
  const before = [{ producto: 1, cantidad: '5' }]
  const result = applyPlan(before, [{ producto: 1, requerido: '165.00' }])
  assert.deepEqual(result, [{ producto: 1, cantidad: '165.00', desdeFicha: true }])
})

test('applyPlan no modifica la cesta original', () => {
  const before = [{ producto: 3, cantidad: '20' }]
  applyPlan(before, [{ producto: 1, requerido: '1.00' }])
  assert.deepEqual(before, [{ producto: 3, cantidad: '20' }])
})

test('applyPlan convierte la cantidad a texto, como el resto de la cesta', () => {
  assert.equal(applyPlan([], [{ producto: 1, requerido: 12.5 }])[0].cantidad, '12.5')
})

test('withoutPlan quita solo las líneas que vienen de una ficha', () => {
  const basket = [{ producto: 1, cantidad: '1', desdeFicha: true }, { producto: 3, cantidad: '2' }]
  assert.deepEqual(withoutPlan(basket), [{ producto: 3, cantidad: '2' }])
})

test('buildOrderBody de producción envía la referencia y la cantidad de prendas, sin la marca de origen', () => {
  const body = buildOrderBody({
    tipo: 'PRODUCCION',
    form: {
      fecha_salida: '2026-10-16', responsable: 'Marta', destino: 'ignorado', referencia: '4', producto_resultado: '9',
      cantidad_prendas: '100', observaciones: '',
    },
    basket: [{ producto: 1, cantidad: '165.00', desdeFicha: true }],
  })
  assert.deepEqual(body, {
    tipo: 'PRODUCCION', fecha_salida: '2026-10-16', responsable: 'Marta', destino: '', referencia: 4,
    producto_resultado: 9, cantidad_prendas: 100, observaciones: '', lineas: [{ producto: 1, cantidad: '165.00' }],
  })
  assert.equal('desdeFicha' in body.lineas[0], false)
})

test('buildOrderBody de lavandería no envía la cantidad de prendas y conserva el destino', () => {
  const body = buildOrderBody({
    tipo: 'LAVANDERIA',
    form: {
      fecha_salida: '2026-10-16', responsable: 'Sol', destino: 'Lavandería Norte', referencia: '4',
      producto_resultado: '8', cantidad_prendas: '55', observaciones: 'urgente',
    },
    basket: [{ producto: 3, cantidad: '20' }],
  })
  assert.equal(body.cantidad_prendas, null)
  assert.equal(body.destino, 'Lavandería Norte')
  assert.equal(body.observaciones, 'urgente')
})

test('isShort compara con el stock del producto', () => {
  assert.equal(isShort({ cantidad: '501' }, PRODUCTS[1]), true)
  assert.equal(isShort({ cantidad: '500' }, PRODUCTS[1]), false)
  assert.equal(isShort({ cantidad: '1' }, undefined), true)
})

const READY = {
  tipo: 'PRODUCCION',
  form: { cantidad_prendas: '100', producto_resultado: '9' },
  basket: [{ producto: 1, cantidad: '165.00' }, { producto: 2, cantidad: '100' }],
  productOf,
  reference: { tiene_ficha: true },
}

test('orderProblems: una orden de producción completa no tiene problemas', () => {
  assert.deepEqual(orderProblems(READY), [])
})

test('orderProblems exige referencia, y en producción que tenga ficha', () => {
  assert.ok(orderProblems({ ...READY, reference: undefined }).includes('Elige la referencia.'))
  assert.ok(orderProblems({ ...READY, reference: { tiene_ficha: false } }).includes('La referencia no tiene ficha técnica.'))
})

test('orderProblems: lavandería no necesita ficha pero sí un pantalón genérico', () => {
  const laundry = {
    ...READY, tipo: 'LAVANDERIA', form: { producto_resultado: '8' }, reference: { tiene_ficha: false },
    basket: [{ producto: 3, cantidad: '20' }],
  }
  assert.deepEqual(orderProblems(laundry), [])
  assert.ok(orderProblems({ ...laundry, basket: [{ producto: 2, cantidad: '5' }] }).includes('Agrega los pantalones genéricos que se envían.'))
})

test('orderProblems exige la cantidad de prendas solo en producción', () => {
  for (const bad of ['', '0', '1.5']) {
    assert.ok(orderProblems({ ...READY, form: { ...READY.form, cantidad_prendas: bad } }).includes('Indica cuántas prendas se producirán.'), bad)
  }
})

test('orderProblems detecta cesta vacía, cantidades en cero y faltantes', () => {
  assert.ok(orderProblems({ ...READY, basket: [] }).includes('La cesta está vacía.'))
  assert.ok(orderProblems({ ...READY, basket: [{ producto: 1, cantidad: '0' }] }).includes('Hay cantidades en cero.'))
  assert.ok(orderProblems({ ...READY, basket: [{ producto: 1, cantidad: '501' }] }).includes('Falta stock de algún material.'))
})

test('orderProblems exige el producto resultante', () => {
  assert.ok(orderProblems({ ...READY, form: { ...READY.form, producto_resultado: '' } }).includes('Elige el producto resultante.'))
})
