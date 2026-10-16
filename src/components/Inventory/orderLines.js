// Lógica pura de la cesta de una orden de salida. Va aparte del formulario para poder probarla sin navegador.
// El consumo por prenda y el redondeo los calcula el servidor (`/api/inventario/fichas-tecnicas/<id>/consumo/`):
// aquí solo se coloca ese resultado en la cesta, así que no hay aritmética decimal en el cliente.

/** Unidades que no admiten decimales (deben coincidir con `WHOLE_UNITS` del backend). */
export const WHOLE = ['rollo', 'caja', 'unidad']

/** `step` del campo de cantidad según la unidad: entero para piezas y centésimas para el resto. */
export const stepFor = (unit) => (WHOLE.includes(unit) ? '1' : '0.01')

/** ¿El texto es un entero positivo (`'12'`)? Rechaza decimales, vacíos, ceros y negativos. */
export const isPositiveInteger = (text) => /^\d+$/.test(String(text ?? '').trim()) && Number(text) > 0

/**
 * Coloca en la cesta los materiales que calculó la ficha técnica.
 * Los materiales que ya venían de una ficha se reemplazan; los que la persona agregó a mano se
 * conservan, salvo los que la ficha también incluye (la ficha manda para no duplicar el producto).
 *
 * @param {{producto: number, cantidad: string, desdeFicha?: boolean}[]} basket
 * @param {{producto: number, requerido: string}[]} lines Líneas de la respuesta de consumo.
 */
export function applyPlan(basket, lines) {
  const planned = new Set(lines.map((line) => line.producto))
  const manual = basket.filter((line) => !line.desdeFicha && !planned.has(line.producto))
  const fromSheet = lines.map((line) => ({ producto: line.producto, cantidad: String(line.requerido), desdeFicha: true }))
  return [...fromSheet, ...manual]
}

/** Quita de la cesta los materiales que vienen de una ficha (al cambiar de referencia o de tipo de orden). */
export const withoutPlan = (basket) => basket.filter((line) => !line.desdeFicha)

/**
 * Cuerpo del POST de una orden. En producción la cantidad de prendas es obligatoria y en lavandería no se envía
 * (el servidor la toma del pantalón genérico que se manda a lavar).
 */
export function buildOrderBody({ form, tipo, basket }) {
  return {
    tipo,
    fecha_salida: form.fecha_salida,
    responsable: form.responsable,
    destino: tipo === 'LAVANDERIA' ? form.destino : '',
    referencia: Number(form.referencia),
    producto_resultado: Number(form.producto_resultado),
    cantidad_prendas: tipo === 'PRODUCCION' ? Number(form.cantidad_prendas) : null,
    observaciones: form.observaciones,
    lineas: basket.map(({ producto, cantidad }) => ({ producto, cantidad })),
  }
}

/** ¿Falta stock para esta línea? Compara con el `stock_actual` del producto (texto numérico). */
export const isShort = (line, product) => Number(line.cantidad) > Number(product?.stock_actual ?? 0)

/**
 * Motivos por los que todavía no se puede registrar la orden (vacío si está lista).
 *
 * @param {object} state
 * @param {'PRODUCCION'|'LAVANDERIA'} state.tipo
 * @param {object} state.form Campos del formulario.
 * @param {{producto: number, cantidad: string}[]} state.basket
 * @param {(id: number) => object|undefined} state.productOf
 * @param {{tiene_ficha: boolean}|undefined} state.reference La referencia elegida.
 */
export function orderProblems({ tipo, form, basket, productOf, reference }) {
  const problems = []
  if (!reference) problems.push('Elige la referencia.')
  else if (tipo === 'PRODUCCION' && !reference.tiene_ficha) problems.push('La referencia no tiene ficha técnica.')
  if (tipo === 'PRODUCCION' && !isPositiveInteger(form.cantidad_prendas)) problems.push('Indica cuántas prendas se producirán.')
  if (!form.producto_resultado) problems.push('Elige el producto resultante.')
  if (basket.length === 0) problems.push('La cesta está vacía.')
  if (basket.some((line) => !(Number(line.cantidad) > 0))) problems.push('Hay cantidades en cero.')
  if (basket.some((line) => isShort(line, productOf(line.producto)))) problems.push('Falta stock de algún material.')
  if (tipo === 'LAVANDERIA' && !basket.some((line) => productOf(line.producto)?.tipo === 'GENERICO')) {
    problems.push('Agrega los pantalones genéricos que se envían.')
  }
  return problems
}
