import test from 'node:test'
import assert from 'node:assert/strict'

import {
  adjustmentBody,
  adjustmentConfirmation,
  adjustmentLines,
  adjustmentProblems,
  adjustmentSummary,
  balance,
  confirmationText,
  differenceLabel,
  enteredTotal,
  entryBody,
  entryProblems,
  initialCounts,
  initialQuantities,
  invalidCounts,
  largeLines,
  plannedMap,
  recentEntries,
  signed,
  sizeSort,
  summaryText,
  variantLabel,
  variantMatrix,
} from './finished.js'

const variants = [
  { id: 1, talla: '30', color: 'Azul oscuro' },
  { id: 2, talla: '32', color: 'Azul oscuro' },
  { id: 3, talla: '28', color: 'Negro' },
  { id: 4, talla: 'M', color: 'Negro' },
]
const pending = { inspeccion: 9, lote_codigo: 'OP-0300-L01', aptas: 50, planificado: [{ variante: 1, cantidad: 30 }, { variante: 2, cantidad: 20 }] }

test('sizeSort: numéricas por valor y las demás por nombre', () => {
  assert.deepEqual(['M', '32', 'S', '28', '30'].sort(sizeSort), ['28', '30', '32', 'M', 'S'])
})

test('variantMatrix: colores en filas y tallas ordenadas en columnas', () => {
  const { sizes, rows } = variantMatrix(variants)
  assert.deepEqual(sizes, ['28', '30', '32', 'M'])
  assert.deepEqual(rows.map((row) => row.color), ['Azul oscuro', 'Negro'])
  assert.equal(rows[0].cells['32'].id, 2)
  assert.equal(rows[1].cells['32'], undefined)
  assert.deepEqual(variantMatrix(undefined), { sizes: [], rows: [] })
})

test('plannedMap e initialQuantities: lo planificado solo si suma las aptas', () => {
  assert.deepEqual(plannedMap(pending), { 1: 30, 2: 20 })
  assert.deepEqual(initialQuantities(pending), { 1: '30', 2: '20' })
  assert.deepEqual(initialQuantities({ ...pending, aptas: 49 }), {}) // no cuadra: se deja vacío
  assert.deepEqual(initialQuantities({ aptas: 10, planificado: [] }), {})
})

test('enteredTotal y balance: faltan, sobran o cuadra', () => {
  assert.equal(enteredTotal({ 1: '30', 2: ' 20 ', 3: 'x', 4: '' }), 50) // lo mal escrito cuenta como cero
  assert.deepEqual(balance(50, { 1: '30', 2: '20' }), { sum: 50, difference: 0, ok: true, message: 'El reparto por talla cuadra con las aptas.' })
  assert.equal(balance(50, { 1: '49' }).message, 'Faltan 1 prenda por ubicar en una talla.')
  assert.equal(balance(50, { 1: '40' }).message, 'Faltan 10 prendas por ubicar en una talla.')
  assert.equal(balance(50, { 1: '51' }).message, 'Sobran 1 prenda: revisa las cantidades.')
  assert.equal(balance(50, { 1: '60' }).difference, -10)
})

test('entryProblems', () => {
  assert.deepEqual(entryProblems({ pending: null, quantities: {} }), ['Elige la inspección.'])
  assert.deepEqual(entryProblems({ pending, quantities: { 1: '30', 2: '20' } }), [])
  assert.equal(entryProblems({ pending, quantities: { 1: '30' } }).length, 1)
  assert.ok(entryProblems({ pending, quantities: { 1: '3.5', 2: '46' } })[0].includes('enteros'))
})

test('entryBody: solo las celdas con cantidad y confirmationText', () => {
  assert.deepEqual(entryBody({ pending, quantities: { 1: '30', 2: ' 20 ', 3: '', 4: '0' }, ubicacion: ' A2 ', observaciones: ' ok ' }), {
    inspeccion: 9, ubicacion: 'A2', observaciones: 'ok',
    lineas: [{ variante: 1, cantidad: 30 }, { variante: 2, cantidad: 20 }],
  })
  const text = confirmationText(pending, { 1: '30', 2: '20' })
  assert.ok(text.includes('50 prendas aptas') && text.includes('OP-0300-L01') && text.includes('no se puede editar'))
})

test('differenceLabel, signed y variantLabel', () => {
  assert.equal(differenceLabel({ diferencia: null }), '—')
  assert.equal(differenceLabel({ diferencia: 0 }), 'igual')
  assert.equal(differenceLabel({ diferencia: 5 }), '+5')
  assert.equal(differenceLabel({ diferencia: -5 }), '-5')
  assert.equal(signed(20), '+20')
  assert.equal(signed(-5), '−5')
  assert.equal(variantLabel(variants[0]), '30 · Azul oscuro')
})

test('recentEntries: ingresos de los últimos días contando hoy', () => {
  const entries = [{ fecha: '2026-11-03' }, { fecha: '2026-10-28' }, { fecha: '2026-10-27' }, { fecha: '2026-10-01' }]
  assert.deepEqual(recentEntries(entries, '2026-11-03', 7).map((e) => e.fecha), ['2026-11-03', '2026-10-28'])
  assert.deepEqual(recentEntries(undefined, '2026-11-03'), [])
})

// --- Ajuste manual (HU 6.3) ---
const reference = {
  referencia: 1, codigo: 'REF-1', nombre: 'Jean', tallas: ['30', '32'],
  colores: [
    { color: 'Azul', tallas: { 30: { variante: 11, cantidad: 20 }, 32: { variante: 12, cantidad: 5 } }, total: 25 },
    { color: 'Negro', tallas: { 30: { variante: 13, cantidad: 0 } }, total: 0 },
  ],
}
const meta = {
  motivos: [
    { codigo: 'ERROR_CONTEO', nombre: 'Error de conteo', signo: '+-' }, { codigo: 'PERDIDA', nombre: 'Pérdida', signo: '-' },
    { codigo: 'SOBRANTE', nombre: 'Sobrante o hallazgo', signo: '+' }, { codigo: 'OTRO', nombre: 'Otro', signo: '+-' },
  ],
  umbral_unidades: 20, observacion_minima: 10, observacion_minima_umbral: 30, motivo_no_valido_sobre_umbral: 'OTRO',
}
const LONG = 'Faltan cajas completas de la estantería B de la bodega'

test('initialCounts: cada celda arranca con el saldo del sistema y sin diferencias', () => {
  const counts = initialCounts(reference)
  assert.deepEqual(counts, { 11: '20', 12: '5', 13: '0' })
  assert.deepEqual(adjustmentLines(reference, counts), [])
  assert.deepEqual(initialCounts(undefined), {})
})

test('adjustmentLines: solo las celdas que difieren, con diferencia = contado - esperado', () => {
  const lines = adjustmentLines(reference, { 11: '18', 12: ' 7 ', 13: '0' })
  assert.deepEqual(lines.map((line) => [line.variante, line.esperado, line.contado, line.diferencia]), [[11, 20, 18, -2], [12, 5, 7, 2]])
  assert.deepEqual(adjustmentLines(reference, { 11: 'x', 12: '5', 13: '' }), []) // lo mal escrito no cuenta
})

test('invalidCounts: vacío, decimal, negativo o texto', () => {
  assert.equal(invalidCounts(reference, { 11: '20', 12: '5', 13: '0' }).length, 0)
  assert.deepEqual(invalidCounts(reference, { 11: '', 12: '2.5', 13: '-1' }).map((cell) => cell.variante), [11, 12, 13])
})

test('adjustmentSummary y summaryText: faltantes y sobrantes por separado, con plural', () => {
  const lines = adjustmentLines(reference, { 11: '17', 12: '6', 13: '0' })
  assert.deepEqual(adjustmentSummary(lines), { missing: 3, surplus: 1, lines: 2 })
  assert.equal(summaryText(adjustmentSummary(lines)), 'Faltan 3 prendas · Sobra 1 prenda')
  assert.equal(summaryText({ missing: 1, surplus: 0 }), 'Falta 1 prenda')
  assert.equal(summaryText({ missing: 0, surplus: 4 }), 'Sobran 4 prendas')
  assert.equal(summaryText({ missing: 0, surplus: 0 }), 'Sin diferencias')
})

test('largeLines: solo las líneas que pasan de 20 unidades, no el total', () => {
  const lines = adjustmentLines(reference, { 11: '15', 12: '0', 13: '21' })
  assert.deepEqual(largeLines(lines, 20).map((line) => line.variante), [13]) // 5 + 5 no son más de 20 cada una
  assert.equal(largeLines(adjustmentLines(reference, { 11: '0', 12: '5', 13: '0' }), 20).length, 0) // exactamente 20 no pasa
})

test('adjustmentProblems: motivo, signo, observación y regla de más de 20 unidades', () => {
  const base = { reference, meta, observacion: 'Conteo del viernes' }
  assert.deepEqual(adjustmentProblems({ ...base, counts: { 11: '19', 12: '5', 13: '0' }, motivo: 'ERROR_CONTEO' }), [])
  assert.ok(adjustmentProblems({ ...base, counts: initialCounts(reference), motivo: 'ERROR_CONTEO' })[0].includes('No hay diferencias'))
  assert.ok(adjustmentProblems({ ...base, counts: { 11: '19', 12: '5', 13: '0' }, motivo: '' }).includes('Elige el motivo del ajuste.'))
  assert.ok(adjustmentProblems({ ...base, counts: { 11: '21', 12: '5', 13: '0' }, motivo: 'PERDIDA' })[0].includes('solo puede restar'))
  assert.ok(adjustmentProblems({ ...base, counts: { 11: '19', 12: '5', 13: '0' }, motivo: 'SOBRANTE' })[0].includes('solo puede sumar'))
  assert.ok(adjustmentProblems({ ...base, counts: { 11: '19', 12: '5', 13: '0' }, motivo: 'PERDIDA', observacion: 'corto' })[0].includes('observación'))
  assert.ok(adjustmentProblems({ ...base, counts: { 11: 'x', 12: '5', 13: '0' }, motivo: 'PERDIDA' })[0].includes('enteros'))
  // más de 20 en una talla: «Otro» no vale y la observación pide 30 caracteres
  const exactly20 = { 11: '0', 12: '5', 13: '0' }
  assert.equal(adjustmentProblems({ ...base, counts: exactly20, motivo: 'PERDIDA' }).length, 0) // 20 exactos no pasan
  const large = { 11: '19', 12: '5', 13: '30' }
  assert.ok(adjustmentProblems({ ...base, counts: large, motivo: 'OTRO', observacion: LONG }).some((text) => text.includes('«Otro» no se acepta')))
  assert.ok(adjustmentProblems({ ...base, counts: large, motivo: 'ERROR_CONTEO' }).some((text) => text.includes('al menos 30')))
  assert.deepEqual(adjustmentProblems({ ...base, counts: large, motivo: 'ERROR_CONTEO', observacion: LONG }), [])
})

test('adjustmentBody: solo las líneas con diferencia y su saldo esperado', () => {
  const body = adjustmentBody({ reference, counts: { 11: '18', 12: '5', 13: '0' }, motivo: 'PERDIDA', observacion: ' Se perdieron dos ', token: 'abc' })
  assert.deepEqual(body, { motivo: 'PERDIDA', observacion: 'Se perdieron dos', token: 'abc', lineas: [{ variante: 11, esperado: 20, contado: 18 }] })
})

test('adjustmentConfirmation: detalle de cada línea y aviso de que no se edita', () => {
  const lines = adjustmentLines(reference, { 11: '18', 12: '7', 13: '0' })
  const text = adjustmentConfirmation(lines, 'Error de conteo')
  assert.ok(text.includes('Error de conteo') && text.includes('20 → 18 (−2)') && text.includes('5 → 7 (+2)'))
  assert.ok(text.includes('Faltan 2 prendas · Sobran 2 prendas') && text.includes('no se puede editar'))
})
