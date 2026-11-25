/**
 * Lógica pura de negocio para Recepción de Lavandería, Cotejo de Cantidades y Pérdidas (TE-58 / TE-172).
 */

/** Motivos de merma (prendas perdidas) que ofrece la lista desplegable de la recepción. */
export const STANDARD_MERMA_REASONS = [
  'Extravío en tinas o centrifugado industrial',
  'Encogimiento térmico excesivo fuera de tolerancia',
  'Faltante en transporte / bultos entregados',
  'Pérdida total en máquina de lavado',
  'Otro motivo de merma',
]

/** Tipos de daño de lavado que ofrece la lista desplegable de la recepción. */
export const STANDARD_DAMAGE_TYPES = [
  'Decoloración irregular o veteado químico',
  'Rotura, desgarro o abrasión excesiva de tela denim',
  'Manchas de químicos o blanqueador no neutralizado',
  'Quemado térmico en tambor de secado',
  'Mancha de óxido o grasa de maquinaria',
  'Defecto en lijado manual o diseño láser',
  'Otro defecto de lavado',
]

/**
 * Calcula el balance de cotejo de un lote enviado a lavandería.
 * @param {number} enviada - Cantidad original enviada.
 * @param {number} conforme - Cantidad conforme recibida en buen estado.
 * @param {number} merma - Cantidad de merma (extravíos).
 * @param {number} danada - Cantidad de prendas defectuosas o dañadas.
 */
export function calculateLotReconciliation(enviada = 0, conforme = 0, merma = 0, danada = 0) {
  const env = Number(enviada) || 0
  const conf = Math.max(0, Number(conforme) || 0)
  const mer = Math.max(0, Number(merma) || 0)
  const dan = Math.max(0, Number(danada) || 0)

  const totalReported = conf + mer + dan
  const diff = env - totalReported // >0 faltan por cotejar, <0 sobran prendas

  return {
    enviada: env,
    conforme: conf,
    merma: mer,
    danada: dan,
    totalReported,
    diff,
    isBalanced: diff === 0 && env > 0,
    hasSurplus: diff < 0,
    hasDeficit: diff > 0,
  }
}

/**
 * Calcula la pérdida financiera de un lote por procesos de terceros.
 */
export function calculateLotLoss(merma = 0, danada = 0, unitCost = 0) {
  const lostUnits = (Math.max(0, Number(merma) || 0)) + (Math.max(0, Number(danada) || 0))
  const parsed = Number(unitCost)
  const cost = Number.isFinite(parsed) && parsed > 0 ? parsed : 0
  return lostUnits * cost
}

/**
 * Valida una fila de cotejo de lote para verificar sumas y campos obligatorios.
 * @returns {string|null} Mensaje de error o null si es válido.
 */
export function validateLotReconciliationRow(row) {
  if (!row) return 'Fila de lote no válida.'

  const label = row.codigo_lote || row.lote_codigo || ''
  const recon = calculateLotReconciliation(
    row.cantidad_enviada,
    row.cantidad_recibida_conforme,
    row.cantidad_merma,
    row.cantidad_danada,
  )

  if (recon.diff > 0) {
    return `Lote ${label}: faltan ${recon.diff} prendas por conciliar (deben sumar ${recon.enviada}).`
  }
  if (recon.diff < 0) {
    return `Lote ${label}: sobran ${Math.abs(recon.diff)} prendas (reportadas ${recon.totalReported} vs enviadas ${recon.enviada}).`
  }

  // Validación de campos obligatorios para mermas o daños
  if (recon.merma > 0 && (!row.motivo_merma || !row.motivo_merma.trim())) {
    return `Lote ${label}: el motivo de merma es obligatorio al registrar ${recon.merma} prendas de extravío.`
  }

  if (recon.danada > 0 && (!row.tipo_dano || !row.tipo_dano.trim())) {
    return `Lote ${label}: el tipo de daño es obligatorio al registrar ${recon.danada} prendas dañadas por la lavandería.`
  }

  if (recon.merma + recon.danada > 0) {
    const unitCost = Number(row.costo_unitario_prenda)
    if (!Number.isFinite(unitCost) || unitCost <= 0) {
      return `Lote ${label}: el costo unitario real de la prenda es obligatorio cuando hay mermas o daños.`
    }
  }

  return null
}

/**
 * Valida los datos generales del formulario de recepción de lavandería antes de enviarlo al servidor.
 * @returns {string|null} Mensaje de error o null si es válido.
 */
export function validateReceptionForm({ activeRemission, facturaExterna, lots = [] } = {}) {
  if (!activeRemission) {
    return 'Debes seleccionar una remisión pendiente de recepción.'
  }
  if (!facturaExterna || !String(facturaExterna).trim()) {
    return 'El número de factura o remisión externa de la lavandería es obligatorio.'
  }
  if (!Array.isArray(lots) || lots.length === 0) {
    return 'La remisión no contiene lotes para cotejar.'
  }
  for (const row of lots) {
    const rowError = validateLotReconciliationRow(row)
    if (rowError) return rowError
  }
  return null
}

/**
 * Calcula totales consolidados de recepción y pérdidas financieras.
 */
export function calculateReceptionTotals(lots = []) {
  let totalEnviado = 0
  let totalConforme = 0
  let totalMerma = 0
  let totalDanada = 0
  let totalPerdidaFinanciera = 0
  let totalServicioLavado = 0

  for (const lot of lots) {
    const env = Number(lot.cantidad_enviada) || 0
    const conf = Number(lot.cantidad_recibida_conforme) || 0
    const mer = Number(lot.cantidad_merma) || 0
    const dan = Number(lot.cantidad_danada) || 0
    const rawCost = Number(lot.costo_unitario_prenda)
    const unitCost = Number.isFinite(rawCost) && rawCost > 0 ? rawCost : 0
    const rawRate = Number(lot.tarifa_lavado)
    const washRate = Number.isFinite(rawRate) && rawRate > 0 ? rawRate : 0

    totalEnviado += env
    totalConforme += conf
    totalMerma += mer
    totalDanada += dan
    totalPerdidaFinanciera += (mer + dan) * unitCost
    totalServicioLavado += conf * washRate
  }

  const allBalanced = lots.length > 0 && lots.every((lot) => {
    const recon = calculateLotReconciliation(
      lot.cantidad_enviada,
      lot.cantidad_recibida_conforme,
      lot.cantidad_merma,
      lot.cantidad_danada,
    )
    return recon.isBalanced
  })

  return {
    totalEnviado,
    totalConforme,
    totalMerma,
    totalDanada,
    totalPerdidaFinanciera,
    totalServicioLavado,
    allBalanced,
    totalLotes: lots.length,
  }
}
