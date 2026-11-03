// Control de calidad (HU 6.1): lógica pura de los formularios, sin React ni DOM, para probarla con `node --test`. El servidor
// valida todo (suma, defectos activos, una inspección por lote, permisos); aquí solo se ofrece lo que tiene sentido y se avisa
// antes de enviar.

/** Máximo de defectos distintos por inspección (igual que el servidor). */
export const MAX_DEFECT_ROWS = 30

const isCount = (text, minimum = 0) => /^\d+$/.test(String(text ?? '').trim()) && Number(String(text).trim()) >= minimum

/** Etiqueta del tipo de defecto. */
export const defectKindLabel = (defect) => (defect.corregible ? 'Corregible' : 'Incorregible')

/** Defectos que todavía se pueden elegir: activos y que no estén ya en el desglose. */
export const availableDefects = (defects, rows) =>
  (defects ?? []).filter((defect) => defect.activo && !rows.some((row) => row.defecto === defect.id))

/** Agrega una fila al desglose de marras. Devuelve `{ rows }` o `{ error }`. */
export function addDefectRow(rows, defect, quantity, note = '') {
  if (!defect) return { error: 'Elige el defecto.' }
  if (rows.some((row) => row.defecto === defect.id)) return { error: `${defect.nombre} ya está en el desglose: cambia su cantidad.` }
  if (rows.length >= MAX_DEFECT_ROWS) return { error: `Máximo ${MAX_DEFECT_ROWS} defectos por inspección.` }
  if (!isCount(quantity, 1)) return { error: 'La cantidad debe ser un entero mayor que cero.' }
  return {
    rows: [...rows, { defecto: defect.id, nombre: defect.nombre, corregible: defect.corregible, cantidad: String(quantity).trim(), nota: String(note ?? '').trim() }],
  }
}

export const removeDefectRow = (rows, defectId) => rows.filter((row) => row.defecto !== defectId)

/** Suma de las marras del desglose (las filas con cantidad mal escrita cuentan como cero). */
export const flawedTotal = (rows) => rows.reduce((sum, row) => sum + (isCount(row.cantidad, 1) ? Number(row.cantidad) : 0), 0)

/**
 * Cómo va la suma: aptas + marras contra lo recibido. `difference` es lo que falta (positivo) o sobra (negativo) y `ok` solo
 * es verdadero cuando cuadra exacto.
 */
export function balance(received, aptas, rows) {
  const good = isCount(aptas) ? Number(String(aptas).trim()) : 0
  const flawed = flawedTotal(rows)
  const sum = good + flawed
  const difference = received - sum
  let message = 'Las aptas y las marras cuadran con lo recibido.'
  if (difference > 0) message = `Faltan ${difference} ${difference === 1 ? 'prenda' : 'prendas'} por clasificar.`
  if (difference < 0) message = `Sobran ${-difference} ${difference === -1 ? 'prenda' : 'prendas'}: revisa las cantidades.`
  return { good, flawed, sum, difference, ok: difference === 0, message }
}

/** Marras sobre lo recibido, en porcentaje con un decimal («9,1 %»). */
export function flawedPercent(flawed, received) {
  if (!received) return '0 %'
  return `${((flawed * 100) / received).toFixed(1).replace('.', ',')} %`
}

/** Motivos por los que todavía no se puede registrar la inspección (vacío si está lista). */
export function inspectionProblems({ lot, aptas, rows }) {
  const problems = []
  if (!lot) return ['Elige el lote.']
  if (!isCount(aptas)) problems.push('Escribe cuántas prendas son aptas (cero o más, entero).')
  if (rows.some((row) => !isCount(row.cantidad, 1))) problems.push('Revisa las cantidades de las marras.')
  if (isCount(aptas) && !balance(lot.cantidad_recibida, aptas, rows).ok) problems.push(balance(lot.cantidad_recibida, aptas, rows).message)
  return problems
}

/** Cuerpo del POST de la inspección. */
export function inspectionBody({ lot, aptas, rows, observaciones }) {
  return {
    lote: lot.id,
    aptas: Number(String(aptas).trim()),
    defectos: rows.map((row) => ({ defecto: row.defecto, cantidad: Number(row.cantidad), nota: row.nota ?? '' })),
    observaciones: (observaciones ?? '').trim(),
  }
}

/** Texto de la confirmación previa: el registro no se edita ni se borra. */
export function confirmationText({ lot, aptas, rows }) {
  const { good, flawed } = balance(lot.cantidad_recibida, aptas, rows)
  return `Vas a registrar la inspección del lote ${lot.codigo}: ${good} aptas y ${flawed} marras de ${lot.cantidad_recibida} recibidas. ` +
    'Una inspección no se puede editar ni borrar. ¿Registrarla?'
}

/** Problema del nombre de un defecto (`''` si está bien). */
export function defectNameProblem(name) {
  const clean = String(name ?? '').replace(/\s+/g, ' ').trim()
  if (clean.length < 3) return 'El nombre debe tener al menos 3 caracteres.'
  if (clean.length > 80) return 'El nombre no puede pasar de 80 caracteres.'
  return ''
}

/** Cuerpo del POST/PATCH de un defecto. */
export const defectBody = (form) => ({
  nombre: form.nombre.replace(/\s+/g, ' ').trim(),
  descripcion: form.descripcion.trim(),
  corregible: form.corregible === 'si',
})

export const emptyDefectForm = () => ({ nombre: '', descripcion: '', corregible: 'si' })

export const defectForm = (defect) => ({ nombre: defect.nombre, descripcion: defect.descripcion ?? '', corregible: defect.corregible ? 'si' : 'no' })
