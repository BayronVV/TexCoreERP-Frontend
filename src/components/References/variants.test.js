// Pruebas unitarias de las funciones puras de tallas y colores. Se ejecutan con `npm test`.
import test from 'node:test'
import assert from 'node:assert/strict'
import {
  addCombinations,
  normalizeColor,
  normalizeSize,
  parseList,
  removeVariant,
  sortVariants,
  variantKey,
} from './variants.js'

test('normaliza la talla en mayúsculas y el color sin espacios de más', () => {
  assert.equal(normalizeSize('  m '), 'M')
  assert.equal(normalizeSize(' 3  0 '), '3 0')
  assert.equal(normalizeColor('  azul   claro '), 'azul claro')
  assert.equal(normalizeSize(null), '')
  assert.equal(normalizeColor(undefined), '')
})

test('la clave ignora mayúsculas del color y espacios', () => {
  assert.equal(variantKey({ talla: ' m', color: ' Azul  Oscuro' }), variantKey({ talla: 'M', color: 'azul oscuro' }))
  assert.notEqual(variantKey({ talla: '30', color: 'Azul' }), variantKey({ talla: '32', color: 'Azul' }))
})

test('parseList separa por coma, punto y coma y saltos de línea', () => {
  assert.deepEqual(parseList('30, 32; 34\n36'), ['30', '32', '34', '36'])
})

test('parseList descarta vacíos y repetidos sin distinguir mayúsculas', () => {
  assert.deepEqual(parseList(' Azul,, azul ,AZUL, Negro ,'), ['Azul', 'Negro'])
  assert.deepEqual(parseList(''), [])
  assert.deepEqual(parseList(null), [])
})

test('sortVariants pone las tallas numéricas por valor y luego las de letras', () => {
  const sorted = sortVariants([
    { talla: 'M', color: 'Negro' },
    { talla: '32', color: 'Azul' },
    { talla: '8', color: 'Azul' },
    { talla: '30', color: 'Negro' },
    { talla: '30', color: 'Azul' },
    { talla: 'S', color: 'Negro' },
  ])
  assert.deepEqual(
    sorted.map((v) => `${v.talla} ${v.color}`),
    ['8 Azul', '30 Azul', '30 Negro', '32 Azul', 'M Negro', 'S Negro'],
  )
})

test('addCombinations genera todas las tallas por colores', () => {
  const { variants, added, skipped, overflow } = addCombinations([], '30, 32', 'Azul, Negro')
  assert.equal(added, 4)
  assert.equal(skipped, 0)
  assert.equal(overflow, false)
  assert.deepEqual(
    variants.map((v) => `${v.talla} ${v.color}`),
    ['30 Azul', '30 Negro', '32 Azul', '32 Negro'],
  )
})

test('addCombinations omite las que ya existen aunque cambie la escritura', () => {
  const current = [{ talla: '30', color: 'Azul' }]
  const { variants, added, skipped } = addCombinations(current, '30, 32', 'azul')
  assert.equal(added, 1)
  assert.equal(skipped, 1)
  assert.equal(variants.length, 2)
  assert.equal(current.length, 1, 'no modifica la lista original')
})

test('addCombinations respeta el máximo y avisa del exceso', () => {
  const { variants, added, overflow } = addCombinations([], '28, 30, 32', 'Azul, Negro', 4)
  assert.equal(variants.length, 4)
  assert.equal(added, 4)
  assert.equal(overflow, true)
})

test('addCombinations sin tallas o sin colores no agrega nada', () => {
  assert.equal(addCombinations([], '', 'Azul').added, 0)
  assert.equal(addCombinations([], '30', '').added, 0)
})

test('removeVariant quita por clave', () => {
  const list = [
    { talla: '30', color: 'Azul' },
    { talla: '32', color: 'Azul' },
  ]
  assert.deepEqual(removeVariant(list, { talla: '30', color: 'AZUL' }), [{ talla: '32', color: 'Azul' }])
  assert.equal(removeVariant(list, { talla: '99', color: 'Rojo' }).length, 2)
})
