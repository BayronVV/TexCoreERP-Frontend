// Tallas y colores de una referencia de jean (HU 3.1). Funciones puras: normalizan igual que el
// backend para que la lista que se arma en pantalla sea la que se guarda.

const collapse = (text) => String(text ?? '').trim().replace(/\s+/g, ' ')

/** Talla normalizada: sin espacios sobrantes y en mayúsculas (`' m '` → `'M'`). */
export const normalizeSize = (text) => collapse(text).toUpperCase()

/** Color normalizado: sin espacios sobrantes (se conserva la escritura). */
export const normalizeColor = (text) => collapse(text)

/** Clave para comparar variantes: la talla en mayúsculas y el color sin distinguir mayúsculas. */
export const variantKey = (variant) => `${normalizeSize(variant.talla)}|${normalizeColor(variant.color).toLowerCase()}`

/**
 * Separa un texto escrito con comas, punto y coma o saltos de línea (`'30, 32; 34'`).
 * Descarta los vacíos y los repetidos (sin distinguir mayúsculas), conservando el orden.
 *
 * @param {string} text
 * @returns {string[]}
 */
export function parseList(text) {
  const seen = new Set()
  const result = []
  for (const part of String(text ?? '').split(/[,;\n]/)) {
    const item = collapse(part)
    if (item && !seen.has(item.toLowerCase())) {
      seen.add(item.toLowerCase())
      result.push(item)
    }
  }
  return result
}

/** Ordena por talla (las numéricas por valor, luego las de letras) y después por color. */
export function sortVariants(variants) {
  const rank = (size) => (/^\d+$/.test(size) ? [0, Number(size), size] : [1, 0, size])
  return [...variants].sort((a, b) => {
    const [ka, kb] = [rank(normalizeSize(a.talla)), rank(normalizeSize(b.talla))]
    return ka[0] - kb[0] || ka[1] - kb[1] || ka[2].localeCompare(kb[2]) || a.color.localeCompare(b.color, 'es')
  })
}

/**
 * Agrega a `current` todas las combinaciones de las tallas y los colores escritos.
 * Las que ya existen se omiten y no se pasa de `max`.
 *
 * @param {{talla: string, color: string}[]} current
 * @param {string} sizesText Tallas separadas por coma.
 * @param {string} colorsText Colores separados por coma.
 * @param {number} [max=60] Máximo de variantes por referencia.
 * @returns {{variants: {talla: string, color: string}[], added: number, skipped: number, overflow: boolean}}
 */
export function addCombinations(current, sizesText, colorsText, max = 60) {
  const keys = new Set(current.map(variantKey))
  const variants = [...current]
  let added = 0
  let skipped = 0
  let overflow = false
  for (const size of parseList(sizesText).map(normalizeSize)) {
    for (const color of parseList(colorsText)) {
      const candidate = { talla: size, color }
      if (keys.has(variantKey(candidate))) {
        skipped += 1
      } else if (variants.length >= max) {
        overflow = true
      } else {
        keys.add(variantKey(candidate))
        variants.push(candidate)
        added += 1
      }
    }
  }
  return { variants: sortVariants(variants), added, skipped, overflow }
}

/** Quita una variante de la lista (compara por clave, no por referencia de objeto). */
export const removeVariant = (variants, target) => variants.filter((v) => variantKey(v) !== variantKey(target))
