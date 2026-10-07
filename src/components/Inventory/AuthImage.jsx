import { useEffect, useState } from 'react'
import { apiRequest } from '../../api/client'

// La imagen exige sesión, así que no puede ir directo en un <img src>: se baja con el token y
// se muestra como blob. Se guarda por producto y versión, y se renueva sola al cambiarla.
const cache = new Map()

/**
 * Imagen de referencia de un producto.
 *
 * @param {object} props
 * @param {number} props.productId
 * @param {number} props.version `imagen_version` del producto: al cambiar, se vuelve a descargar.
 * @param {string} props.alt
 * @param {string} [props.className]
 * @param {(failed: boolean) => import('react').ReactNode} props.placeholder Qué mostrar mientras carga o si falla.
 */
export default function AuthImage({ productId, version, alt, className, placeholder }) {
  const key = `${productId}:${version}`
  const [, refresh] = useState(0)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    if (cache.has(key)) return undefined
    let alive = true
    apiRequest(`/api/inventario/catalogo/${productId}/imagen/`, { blob: true })
      .then((blob) => {
        cache.set(key, URL.createObjectURL(blob))
        if (alive) refresh((n) => n + 1)
      })
      .catch(() => alive && setFailed(true))
    return () => {
      alive = false
    }
  }, [key, productId])

  const src = cache.get(key)
  if (!src) return placeholder(failed)
  return <img src={src} alt={alt} className={className} loading="lazy" />
}
