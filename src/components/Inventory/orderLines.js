// Lógica pura de la cesta de una orden de salida (hoy, la salida a lavandería). Va aparte del formulario para poder
// probarla sin navegador. El consumo de las órdenes de producción lo calcula el servidor con la ficha técnica.

/** Unidades que no admiten decimales (deben coincidir con `WHOLE_UNITS` del backend). */
export const WHOLE = ['rollo', 'caja', 'unidad']

/** `step` del campo de cantidad según la unidad: entero para piezas y centésimas para el resto. */
export const stepFor = (unit) => (WHOLE.includes(unit) ? '1' : '0.01')

/** ¿El texto es un entero positivo (`'12'`)? Rechaza decimales, vacíos, ceros y negativos. */
export const isPositiveInteger = (text) => /^\d+$/.test(String(text ?? '').trim()) && Number(text) > 0

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
