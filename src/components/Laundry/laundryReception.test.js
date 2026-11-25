import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  calculateLotReconciliation,
  calculateLotLoss,
  validateLotReconciliationRow,
  validateReceptionForm,
  calculateReceptionTotals,
} from './laundryReception.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

test('calculateLotReconciliation: balance exacto cuando conformes + mermas + danadas suman enviadas', () => {
  const recon = calculateLotReconciliation(100, 95, 3, 2)
  assert.equal(recon.isBalanced, true)
  assert.equal(recon.diff, 0)
  assert.equal(recon.totalReported, 100)
  assert.equal(recon.hasDeficit, false)
  assert.equal(recon.hasSurplus, false)
})

test('calculateLotReconciliation: acepta 0 conformes y 40 merma cuando suman el total enviado', () => {
  const recon = calculateLotReconciliation(40, 0, 40, 0)
  assert.equal(recon.isBalanced, true)
  assert.equal(recon.diff, 0)
  assert.equal(recon.conforme, 0)
  assert.equal(recon.merma, 40)
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

test('calculateLotLoss: calcula costo financiero exacto sin valor por defecto inventado', () => {
  assert.equal(calculateLotLoss(4, 2, 32000), 192000)
  assert.equal(calculateLotLoss(4, 2, 0), 0)
  assert.equal(calculateLotLoss(0, 0, 32000), 0)
})

test('validateLotReconciliationRow: valida cuando hay 0 conformes y 40 mermas con motivo y costo real', () => {
  const row = {
    codigo_lote: 'LOTE-01',
    cantidad_enviada: 40,
    cantidad_recibida_conforme: 0,
    cantidad_merma: 40,
    motivo_merma: 'Pérdida total en tina de lavado',
    cantidad_danada: 0,
    tipo_dano: '',
    costo_unitario_prenda: 29500,
  }
  assert.equal(validateLotReconciliationRow(row), null)
})

test('validateLotReconciliationRow: exige motivo obligatorio cuando hay merma', () => {
  const row = {
    codigo_lote: 'LOTE-02',
    cantidad_enviada: 50,
    cantidad_recibida_conforme: 48,
    cantidad_merma: 2,
    motivo_merma: '',
    cantidad_danada: 0,
    tipo_dano: '',
    costo_unitario_prenda: 25000,
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
    tipo_dano: '   ',
    costo_unitario_prenda: 25000,
  }
  const error = validateLotReconciliationRow(row)
  assert.match(error, /tipo de daño es obligatorio/)
})

test('validateLotReconciliationRow: exige costo unitario real cuando hay pérdidas y no viene del sistema', () => {
  const row = {
    codigo_lote: 'LOTE-04',
    cantidad_enviada: 40,
    cantidad_recibida_conforme: 38,
    cantidad_merma: 2,
    motivo_merma: 'Extravío',
    cantidad_danada: 0,
    tipo_dano: '',
    costo_unitario_prenda: '',
  }
  const error = validateLotReconciliationRow(row)
  assert.match(error, /costo unitario real/i)
})

test('validateReceptionForm: exige factura externa obligatoria y filas válidas', () => {
  const validLot = {
    codigo_lote: 'LOTE-05',
    cantidad_enviada: 60,
    cantidad_recibida_conforme: 60,
    cantidad_merma: 0,
    cantidad_danada: 0,
  }
  assert.match(
    validateReceptionForm({ activeRemission: { id: 1 }, facturaExterna: '  ', lots: [validLot] }),
    /factura o remisión externa/i,
  )
  assert.equal(
    validateReceptionForm({ activeRemission: { id: 1 }, facturaExterna: 'FAC-100', lots: [validLot] }),
    null,
  )
})

test('calculateReceptionTotals: acumula totales y usa 0 cuando faltan costos o tarifas', () => {
  const lots = [
    {
      cantidad_enviada: 60,
      cantidad_recibida_conforme: 55,
      cantidad_merma: 3,
      cantidad_danada: 2,
      costo_unitario_prenda: 31000,
      tarifa_lavado: 3500,
    },
    {
      cantidad_enviada: 40,
      cantidad_recibida_conforme: 40,
      cantidad_merma: 0,
      cantidad_danada: 0,
      costo_unitario_prenda: null,
      tarifa_lavado: 0,
    },
  ]
  const totals = calculateReceptionTotals(lots)
  assert.equal(totals.totalEnviado, 100)
  assert.equal(totals.totalConforme, 95)
  assert.equal(totals.totalMerma, 3)
  assert.equal(totals.totalDanada, 2)
  assert.equal(totals.totalPerdidaFinanciera, 5 * 31000)
  assert.equal(totals.totalServicioLavado, 55 * 3500)
  assert.equal(totals.allBalanced, true)
})

test('TE-172: sin archivos mock ni valores inventados y manejo explícito de error en lavandería', () => {
  assert.equal(fs.existsSync(path.join(__dirname, 'mockLaundryData.js')), false)
  assert.equal(fs.existsSync(path.join(__dirname, '..', 'Production', 'mockSettlementData.js')), false)

  const remissionSrc = fs.readFileSync(path.join(__dirname, 'LaundryRemissionPage.jsx'), 'utf8')
  const receptionSrc = fs.readFileSync(path.join(__dirname, 'LaundryReceptionPage.jsx'), 'utf8')

  for (const src of [remissionSrc, receptionSrc]) {
    assert.doesNotMatch(src, /mockLaundryData/)
    assert.doesNotMatch(src, /DEFAULT_GARMENT_UNIT_COST/)
    assert.match(src, /loadError/)
    assert.match(src, /role="alert"/)
    assert.doesNotMatch(src, /notify\.error|notify\.success/)
  }

  assert.doesNotMatch(remissionSrc, /REC-SW-01|Conductor TexCore|WXY-789/)
  assert.doesNotMatch(receptionSrc, /FAC-LAV-/)
})
