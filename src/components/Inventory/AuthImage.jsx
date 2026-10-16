import { useEffect, useState } from 'react'
import { apiRequest } from '../../api/client'

// La imagen exige sesión, así que no puede ir directo en un <img src>: se baja con el token y
// se muestra como blob. Se guarda por producto y versión, y se renueva sola al cambiarla.
const cache = new Map()

/**
 * Imagen protegida por sesión: la de referencia de un producto o cualquier otra ruta de la API.
 *
 * @param {object} props
 * @param {number} [props.productId] Producto del catálogo de insumos (se ignora si llega `path`).
 * @param {string} [props.path] Ruta de la imagen en la API, p. ej. `/api/referencias/imagenes/3/archivo/`.
 * @param {number} props.version Versión de la imagen: al cambiar, se vuelve a descargar.
 * @param {string} props.alt
 * @param {string} [props.className]
 * @param {(failed: boolean) => import('react').ReactNode} props.placeholder Qué mostrar mientras carga o si falla.
 */
export default function AuthImage({ productId, path, version, alt, className, placeholder }) {
  const url = path ?? `/api/inventario/catalogo/${productId}/imagen/`
  const key = `${url}:${version}`
  const [, refresh] = useState(0)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    if (cache.has(key)) return undefined
    let alive = true
    apiRequest(url, { blob: true })
      .then((blob) => {
        cache.set(key, URL.createObjectURL(blob))
        if (alive) refresh((n) => n + 1)
      })
      .catch(() => alive && setFailed(true))
    return () => {
      alive = false
    }
  }, [key, url])

  const src = cache.get(key)
  if (!src) return placeholder(failed)
  return <img src={src} alt={alt} className={className} loading="lazy" />
}
