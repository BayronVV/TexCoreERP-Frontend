// Cliente HTTP para las pantallas nuevas (sesión, seguridad). Login y Register
// todavía usan axios directamente.
// La URL base viene de VITE_API_URL (ver .env.example).

const API_URL = (import.meta.env.VITE_API_URL || 'http://localhost:8000').replace(/\/$/, '')

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
  if (body !== undefined) headers['Content-Type'] = 'application/json'
  if (token) headers.Authorization = `Bearer ${token}`
  try {
    return await fetch(`${API_URL}${path}`, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
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

export async function apiRequest(path, { method = 'GET', body, auth = true } = {}) {
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

  const data = response.status === 204 ? null : await response.json().catch(() => null)
  if (!response.ok) throw new ApiError(response.status, data)
  return data
}

export function apiGet(path, options) {
  return apiRequest(path, { ...options, method: 'GET' })
}

export { API_URL }
