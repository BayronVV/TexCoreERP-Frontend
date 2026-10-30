import test from 'node:test'
import assert from 'node:assert/strict'
import {
  calculateLotReconciliation,
  calculateLotLoss,
  validateLotReconciliationRow,
  calculateReceptionTotals,
} from './laundryReception.js'

test('calculateLotReconciliation: balance exacto cuando conformes + mermas + danadas suman enviadas', () => {
  const recon = calculateLotReconciliation(100, 95, 3, 2)
  assert.equal(recon.isBalanced, true)
  assert.equal(recon.diff, 0)
  assert.equal(recon.totalReported, 100)
  assert.equal(recon.hasDeficit, false)
  assert.equal(recon.hasSurplus, false)
})

test('calculateLotReconciliation: detecta faltante (déficit de prendas sin conciliar)', () => {
  const recon = calculateLotReconciliation(100, 90, 2, 0)
  assert.equal(recon.isBalanced, false)
  assert.equal(recon.diff, 8)
  assert.equal(recon.hasDeficit, true)
  assert.equal(recon.hasSurplus, false)
})

test('calculateLotReconciliation: detecta sobrante de prendas', () => {
  const recon = calculateLotReconciliation(50, 48, 2, 3)
  assert.equal(recon.isBalanced, false)
  assert.equal(recon.diff, -3)
  assert.equal(recon.hasSurplus, true)
})

test('calculateLotLoss: calcula costo financiero exacto de mermas y daños', () => {
  // 4 mermas + 2 dañadas = 6 prendas * $35.000 = $210.000
  const loss = calculateLotLoss(4, 2, 35000)
  assert.equal(loss, 210000)

  // Sin mermas ni daños = $0
  assert.equal(calculateLotLoss(0, 0, 35000), 0)
})

test('validateLotReconciliationRow: valida cuando todo cuadra con motivos indicados', () => {
  const row = {
    codigo_lote: 'LOTE-01',
    cantidad_enviada: 60,
    cantidad_recibida_conforme: 55,
    cantidad_merma: 3,
    motivo_merma: 'Extravío en tina de centrifugado',
    cantidad_danada: 2,
    tipo_dano: 'Decoloración química irregular',
  }
  const error = validateLotReconciliationRow(row)
  assert.equal(error, null)
})

test('validateLotReconciliationRow: exige motivo obligatorio cuando hay merma', () => {
  const row = {
    codigo_lote: 'LOTE-02',
    cantidad_enviada: 50,
    cantidad_recibida_conforme: 48,
    cantidad_merma: 2,
    motivo_merma: '', // Falta motivo obligatorio
    cantidad_danada: 0,
    tipo_dano: '',
  }
  const error = validateLotReconciliationRow(row)
  assert.match(error, /motivo de merma es obligatorio/)
})

test('validateLotReconciliationRow: exige tipo de daño obligatorio cuando hay prendas defectuosas', () => {
  const row = {
    codigo_lote: 'LOTE-03',
    cantidad_enviada: 50,
    cantidad_recibida_conforme: 47,
    cantidad_merma: 0,
    motivo_merma: '',
    cantidad_danada: 3,
    tipo_dano: '   ', // Falta tipo de daño obligatorio
  }
  const error = validateLotReconciliationRow(row)
  assert.match(error, /tipo de daño es obligatorio/)
})

test('calculateReceptionTotals: acumula totales y pérdidas entre múltiples lotes', () => {
  const lots = [
    {
      cantidad_enviada: 60,
      cantidad_recibida_conforme: 55,
      cantidad_merma: 3,
      cantidad_danada: 2,
      costo_unitario_prenda: 35000,
      tarifa_lavado: 3500,
    },
    {
      cantidad_enviada: 40,
      cantidad_recibida_conforme: 38,
      cantidad_merma: 1,
      cantidad_danada: 1,
      costo_unitario_prenda: 40000,
      tarifa_lavado: 4000,
    },
  ]

  const totals = calculateReceptionTotals(lots)
  assert.equal(totals.totalEnviado, 100)
  assert.equal(totals.totalConforme, 93)
  assert.equal(totals.totalMerma, 4)
  assert.equal(totals.totalDanada, 3)
  // Lote 1: (3+2)*35000 = 175.000. Lote 2: (1+1)*40000 = 80.000. Total = 255.000
  assert.equal(totals.totalPerdidaFinanciera, 255000)
  // Servicio lavado: 55*3500 (192.500) + 38*4000 (152.000) = 344.500
  assert.equal(totals.totalServicioLavado, 344500)
  assert.equal(totals.allBalanced, true)
})
