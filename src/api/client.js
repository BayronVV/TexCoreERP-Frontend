// Cliente HTTP mínimo. Todas las llamadas al backend pasan por aquí.
// La URL base viene de VITE_API_URL (ver .env.example).

const API_URL = (import.meta.env.VITE_API_URL || 'http://localhost:8000').replace(/\/$/, '')

export async function apiGet(path) {
  const response = await fetch(`${API_URL}${path}`, {
    headers: { Accept: 'application/json' },
  })
  const body = await response.json().catch(() => null)
  if (!response.ok) {
    const error = new Error(body?.detail || `HTTP ${response.status}`)
    error.body = body
    throw error
  }
  return body
}

export { API_URL }
