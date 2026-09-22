import { useEffect, useState } from 'react'
import { API_URL, apiGet } from './api/client'

// Vista temporal del Sprint 0: solo comprueba que el frontend habla con el
// backend y que el backend habla con la base de datos. Se reemplaza en Sprint 1.

function useCheck(path) {
  const [state, setState] = useState({ loading: true })

  useEffect(() => {
    let cancelled = false
    apiGet(path)
      .then((data) => !cancelled && setState({ data }))
      .catch((error) => !cancelled && setState({ error: error.message, data: error.body }))
    return () => {
      cancelled = true
    }
  }, [path])

  return state
}

function StatusRow({ label, state }) {
  const status = state.loading ? 'loading' : state.error ? 'error' : 'ok'
  const text = { loading: 'Verificando…', error: state.error, ok: 'Conectado' }[status]
  return (
    <li className={`status status--${status}`}>
      <span className="status__label">{label}</span>
      <span className="status__value">{text}</span>
    </li>
  )
}

export default function App() {
  const api = useCheck('/api/health/')
  const db = useCheck('/api/health/db/')

  return (
    <main className="container">
      <h1>TexCore</h1>
      <p className="muted">Sprint 0 · verificación de conexión</p>

      <ul className="status-list">
        <StatusRow label="Backend" state={api} />
        <StatusRow label="Base de datos" state={db} />
      </ul>

      <dl className="details">
        <dt>API</dt>
        <dd>{API_URL}</dd>
        {api.data && (
          <>
            <dt>Versión</dt>
            <dd>
              {api.data.version} ({api.data.environment})
            </dd>
          </>
        )}
        {db.data?.vendor && (
          <>
            <dt>Motor</dt>
            <dd>
              {db.data.vendor} {db.data.server_version}
            </dd>
          </>
        )}
        {db.data?.latency_ms !== undefined && (
          <>
            <dt>Latencia BD</dt>
            <dd>{db.data.latency_ms} ms</dd>
          </>
        )}
      </dl>
    </main>
  )
}
