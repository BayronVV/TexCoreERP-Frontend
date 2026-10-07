// Cliente HTTP para las pantallas nuevas (sesión, seguridad). Login y Register
// todavía usan axios directamente.
// La URL base viene de VITE_API_URL (ver .env.example).

const API_URL = (import.meta.env.VITE_API_URL || 'http://localhost:8000').replace(/\/$/, '')

/**
 * Error de una respuesta de la API.
 * `status` es el código HTTP (0 si no hubo conexión) y `body` el cuerpo JSON, p. ej. `{campo: [mensaje]}`.
 */
class ApiError extends Error {
  constructor(status, body) {
    super(firstErrorMessage(body) || `Error ${status}`)
    this.status = status
    this.body = body
  }
}

// DRF devuelve errores como {detail}, {campo: [msg]} o [msg]; nos quedamos con el primero legible.
function firstErrorMessage(body) {
  if (!body) return null
  if (typeof body === 'string') return body
  if (Array.isArray(body)) return firstErrorMessage(body[0])
  if (body.detail) return firstErrorMessage(body.detail)
  const firstKey = Object.keys(body)[0]
  return firstKey ? firstErrorMessage(body[firstKey]) : null
}

async function send(path, { method, body, token }) {
  const headers = { Accept: 'application/json' }
  // Con FormData el navegador pone el Content-Type (con el boundary) por su cuenta.
  const isForm = body instanceof FormData
  if (body !== undefined && !isForm) headers['Content-Type'] = 'application/json'
  if (token) headers.Authorization = `Bearer ${token}`
  try {
    return await fetch(`${API_URL}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : isForm ? body : JSON.stringify(body),
    })
  } catch {
    throw new ApiError(0, { detail: 'No hay conexión con el servidor. Revisa que el backend esté encendido.' })
  }
}

// El access token dura poco; si vence a mitad de la sesión se renueva una vez
// con el refresh token. Si eso también falla, la sesión terminó.
async function renewAccessToken() {
  const refresh = localStorage.getItem('refresh_token')
  if (!refresh) return null
  const response = await send('/api/token/refresh/', { method: 'POST', body: { refresh } })
  if (!response.ok) return null
  // El backend rota el refresh token: cada renovación entrega uno nuevo.
  const { access, refresh: rotated } = await response.json()
  localStorage.setItem('access_token', access)
  if (rotated) localStorage.setItem('refresh_token', rotated)
  return access
}

/**
 * Llama a la API con el token de la sesión.
 * Si el access token venció lo renueva una vez con el refresh; si eso falla emite `texcore:session-expired`.
 *
 * @param {string} path Ruta, p. ej. `/api/inventario/productos/`.
 * @param {object} [options]
 * @param {'GET'|'POST'|'PATCH'|'DELETE'} [options.method='GET']
 * @param {object|FormData} [options.body] JSON o FormData (archivos).
 * @param {boolean} [options.auth=true] `false` para rutas públicas (login, registro).
 * @param {boolean} [options.blob=false] `true` para descargar un archivo en lugar de JSON.
 * @returns {Promise<any>} El JSON de la respuesta (o un Blob).
 * @throws {ApiError} Si la respuesta no es 2xx.
 */
export async function apiRequest(path, { method = 'GET', body, auth = true, blob = false } = {}) {
  const token = auth ? localStorage.getItem('access_token') : null
  let response = await send(path, { method, body, token })

  if (response.status === 401 && token) {
    const renewed = await renewAccessToken()
    if (renewed) {
      response = await send(path, { method, body, token: renewed })
    } else {
      window.dispatchEvent(new Event('texcore:session-expired'))
    }
  }

  if (blob && response.ok) return response.blob()
  const data = response.status === 204 ? null : await response.json().catch(() => null)
  if (!response.ok) throw new ApiError(response.status, data)
  return data
}

/** Atajo de {@link apiRequest} para peticiones GET. */
export function apiGet(path, options) {
  return apiRequest(path, { ...options, method: 'GET' })
}

/** URL base del backend (`VITE_API_URL`). */
export { API_URL }
