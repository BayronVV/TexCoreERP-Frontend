import { useEffect, useState } from 'react'
import { apiGet } from '../../api/client'

// Categorías, unidades y reglas del catálogo vienen del backend: así la pantalla y el
// servidor nunca discrepan. Se piden una sola vez por sesión.
let pending = null
const load = () => {
  pending ??= apiGet('/api/inventario/metadatos/').catch((error) => {
    pending = null
    throw error
  })
  return pending
}

/**
 * Hook que entrega los metadatos del catálogo (`{ meta, error }`): categorías, unidades y reglas.
 * Se piden una sola vez por sesión y se comparten entre pantallas.
 */
export function useInventoryMeta() {
  const [state, setState] = useState({ meta: null, error: '' })
  useEffect(() => {
    let alive = true
    load()
      .then((meta) => alive && setState({ meta, error: '' }))
      .catch((error) => alive && setState({ meta: null, error: error.message }))
    return () => {
      alive = false
    }
  }, [])
  return state
}

/** Busca una categoría por su código (p. ej. `TELA`) en los metadatos. */
export const categoryOf = (meta, code) => meta?.categorias.find((category) => category.codigo === code)
/** Nombre legible de una unidad (`m` → «Metro»); si no existe devuelve el código. */
export const unitName = (meta, code) => meta?.unidades.find((unit) => unit.codigo === code)?.nombre ?? code
