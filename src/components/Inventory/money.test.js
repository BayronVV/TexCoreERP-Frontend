// Pruebas unitarias del formato de dinero y de la validación del costo. Se ejecutan con `npm test`.
import test from 'node:test'
import assert from 'node:assert/strict'
import { costError, formatMoney, purchaseValue } from './money.js'

const plain = (text) => text.replace(/ /g, ' ')

test('formatMoney: pesos con separador de miles y decimales solo si hacen falta', () => {
  assert.equal(plain(formatMoney(18500)), '$ 18.500')
  assert.equal(plain(formatMoney('18500.0000')), '$ 18.500')
  assert.equal(plain(formatMoney('1234.56')), '$ 1.234,56')
  assert.equal(plain(formatMoney(0)), '$ 0')
  assert.equal(plain(formatMoney('20230.7692')), '$ 20.230,77')
})

test('formatMoney: sin dato válido muestra una raya', () => {
  for (const empty of [null, undefined, '', 'abc', NaN]) assert.equal(formatMoney(empty), '—')
})

test('costError: vacío está bien porque el costo es opcional', () => {
  for (const empty of ['', '   ', undefined, null]) assert.equal(costError(empty), '')
})

test('costError: acepta enteros y hasta cuatro decimales', () => {
  for (const ok of ['18500', '0.5', '12.3456', ' 7 ', '100.1']) assert.equal(costError(ok), '', ok)
})

test('costError: rechaza cero, negativos, texto y demasiados decimales', () => {
  assert.equal(costError('0'), 'El costo debe ser mayor que cero.')
  assert.equal(costError('0.0000'), 'El costo debe ser mayor que cero.')
  assert.equal(costError('-5'), 'El costo debe ser mayor que cero.')
  assert.match(costError('abc'), /número/)
  assert.match(costError('18,5'), /punto/)
  assert.match(costError('1e3'), /número/)
  assert.equal(costError('1.23456'), 'El costo admite hasta 4 decimales.')
})

test('purchaseValue: cantidad por costo, redondeado a centavos', () => {
  assert.equal(purchaseValue('150', '18500'), 2775000)
  assert.equal(purchaseValue('2.5', '3.3333'), 8.33)
})

test('purchaseValue: sin cantidad o sin costo válido no hay valor', () => {
  assert.equal(purchaseValue('', '100'), null)
  assert.equal(purchaseValue('0', '100'), null)
  assert.equal(purchaseValue('10', ''), null)
  assert.equal(purchaseValue('10', '-4'), null)
  assert.equal(purchaseValue('10', 'abc'), null)
})
