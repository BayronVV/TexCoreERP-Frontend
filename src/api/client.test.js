import test from 'node:test'
import assert from 'node:assert/strict'
import { ApiError, apiGet, apiRequest, firstErrorMessage } from './client.js'

function mockEnvironment({ fetchImpl, initialStorage = {} }) {
  const store = new Map(Object.entries(initialStorage))
  const dispatched = []

  const previousFetch = globalThis.fetch
  const previousStorage = globalThis.localStorage
  const previousWindow = globalThis.window

  globalThis.localStorage = {
    getItem: (key) => (store.has(key) ? store.get(key) : null),
    setItem: (key, value) => store.set(key, String(value)),
    removeItem: (key) => store.delete(key),
  }
  globalThis.window = {
    dispatchEvent: (event) => dispatched.push(event.type),
  }
  globalThis.fetch = fetchImpl

  return {
    store,
    dispatched,
    restore() {
      globalThis.fetch = previousFetch
      globalThis.localStorage = previousStorage
      globalThis.window = previousWindow
    },
  }
}

function jsonResponse(status, data) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => data,
    blob: async () => data,
  }
}

test('firstErrorMessage extrae el primer mensaje legible de formatos DRF', () => {
  assert.equal(firstErrorMessage({ detail: 'Sin permiso.' }), 'Sin permiso.')
  assert.equal(firstErrorMessage({ cantidad: ['No hay tela suficiente.'] }), 'No hay tela suficiente.')
  assert.equal(firstErrorMessage(['Error general.']), 'Error general.')
  assert.equal(firstErrorMessage('Texto plano'), 'Texto plano')
  assert.equal(firstErrorMessage(null), null)
})

test('apiGet envía Authorization Bearer cuando hay token y devuelve JSON', async () => {
  const calls = []
  const env = mockEnvironment({
    initialStorage: { access_token: 'tok-1' },
    fetchImpl: async (url, init) => {
      calls.push({ url, init })
      return jsonResponse(200, { ok: true, items: [1, 2] })
    },
  })

  try {
    const data = await apiGet('/api/inventario/productos/')
    assert.deepEqual(data, { ok: true, items: [1, 2] })
    assert.equal(calls.length, 1)
    assert.match(calls[0].url, /\/api\/inventario\/productos\/$/)
    assert.equal(calls[0].init.method, 'GET')
    assert.equal(calls[0].init.headers.Authorization, 'Bearer tok-1')
  } finally {
    env.restore()
  }
})

test('apiRequest renueva el access token tras un 401 y reintenta la petición original', async () => {
  const calls = []
  const env = mockEnvironment({
    initialStorage: { access_token: 'vencido', refresh_token: 'ref-1' },
    fetchImpl: async (url, init) => {
      calls.push({ url, init })
      if (url.endsWith('/api/token/refresh/')) {
        return jsonResponse(200, { access: 'nuevo-access', refresh: 'ref-2' })
      }
      if (calls.length === 1) {
        return jsonResponse(401, { detail: 'Token vencido' })
      }
      return jsonResponse(200, { id: 10 })
    },
  })

  try {
    const res = await apiRequest('/api/auth/me/')
    assert.deepEqual(res, { id: 10 })
    assert.equal(calls.length, 3)
    assert.equal(calls[2].init.headers.Authorization, 'Bearer nuevo-access')
    assert.equal(env.store.get('access_token'), 'nuevo-access')
    assert.equal(env.store.get('refresh_token'), 'ref-2')
    assert.deepEqual(env.dispatched, [])
  } finally {
    env.restore()
  }
})

test('apiRequest emite texcore:session-expired si falla la renovación del token', async () => {
  const env = mockEnvironment({
    initialStorage: { access_token: 'vencido', refresh_token: 'ref-malo' },
    fetchImpl: async () => jsonResponse(401, { detail: 'Sesión expirada' }),
  })

  try {
    await assert.rejects(
      () => apiGet('/api/auth/me/'),
      (err) => err instanceof ApiError && err.status === 401 && err.message === 'Sesión expirada',
    )
    assert.deepEqual(env.dispatched, ['texcore:session-expired'])
  } finally {
    env.restore()
  }
})

test('apiRequest traduce fallo de red en ApiError con status 0', async () => {
  const env = mockEnvironment({
    fetchImpl: async () => {
      throw new TypeError('Failed to fetch')
    },
  })

  try {
    await assert.rejects(
      () => apiRequest('/api/health/', { auth: false }),
      (err) => err instanceof ApiError && err.status === 0 && /No hay conexión con el servidor/.test(err.message),
    )
  } finally {
    env.restore()
  }
})

test('apiRequest propaga errores 400 con el primer mensaje de validación', async () => {
  const env = mockEnvironment({
    initialStorage: { access_token: 'tok-1' },
    fetchImpl: async () => jsonResponse(400, { accion: ['No hay una etapa en curso para terminar.'] }),
  })

  try {
    await assert.rejects(
      () => apiRequest('/api/produccion/lotes/1/completar/', { method: 'POST', body: {} }),
      (err) =>
        err instanceof ApiError &&
        err.status === 400 &&
        err.message === 'No hay una etapa en curso para terminar.' &&
        err.body.accion[0] === 'No hay una etapa en curso para terminar.',
    )
  } finally {
    env.restore()
  }
})

test('varias peticiones con el token vencido renuevan la sesión una sola vez (el refresh rota y solo sirve una vez)', async () => {
  const calls = []
  let refreshUses = 0
  const env = mockEnvironment({
    initialStorage: { access_token: 'vencido', refresh_token: 'ref-1' },
    fetchImpl: async (url, init) => {
      calls.push(url)
      if (url.endsWith('/api/token/refresh/')) {
        refreshUses += 1
        // El servidor invalida el refresh en cuanto se usa: una segunda renovación con 'ref-1' falla.
        if (refreshUses > 1) return jsonResponse(401, { detail: 'Token en lista negra' })
        await new Promise((resolve) => setTimeout(resolve, 5))
        return jsonResponse(200, { access: 'nuevo-access', refresh: 'ref-2' })
      }
      if (init.headers.Authorization === 'Bearer vencido') return jsonResponse(401, { detail: 'Token vencido' })
      return jsonResponse(200, { ok: url })
    },
  })

  try {
    const results = await Promise.all([
      apiGet('/api/uno/'),
      apiGet('/api/dos/'),
      apiGet('/api/tres/'),
    ])
    assert.equal(results.length, 3)
    assert.ok(results.every((item) => item.ok))
    assert.equal(calls.filter((url) => url.endsWith('/api/token/refresh/')).length, 1)
    assert.equal(env.store.get('access_token'), 'nuevo-access')
    assert.equal(env.store.get('refresh_token'), 'ref-2')
    assert.deepEqual(env.dispatched, [])
  } finally {
    env.restore()
  }
})

test('una petición cuyo token ya fue reemplazado por otra renovación usa el nuevo sin volver a renovar', async () => {
  const calls = []
  const env = mockEnvironment({
    initialStorage: { access_token: 'vencido', refresh_token: 'ref-1' },
    fetchImpl: async (url, init) => {
      calls.push({ url, auth: init.headers.Authorization })
      if (init.headers.Authorization === 'Bearer vencido') {
        env.store.set('access_token', 'ya-renovado') // otra petición renovó mientras esta esperaba
        return jsonResponse(401, { detail: 'Token vencido' })
      }
      return jsonResponse(200, { ok: true })
    },
  })

  try {
    assert.deepEqual(await apiGet('/api/uno/'), { ok: true })
    assert.equal(calls.some((call) => call.url.endsWith('/api/token/refresh/')), false)
    assert.equal(calls[1].auth, 'Bearer ya-renovado')
  } finally {
    env.restore()
  }
})

test('si la renovación falla, todas las peticiones simultáneas terminan la sesión y una petición posterior puede intentarlo de nuevo', async () => {
  let refreshCalls = 0
  const env = mockEnvironment({
    initialStorage: { access_token: 'vencido', refresh_token: 'ref-malo' },
    fetchImpl: async (url) => {
      if (url.endsWith('/api/token/refresh/')) {
        refreshCalls += 1
        return jsonResponse(401, { detail: 'Refresh inválido' })
      }
      return jsonResponse(401, { detail: 'Token vencido' })
    },
  })

  try {
    const outcomes = await Promise.allSettled([apiGet('/api/uno/'), apiGet('/api/dos/')])
    assert.ok(outcomes.every((item) => item.status === 'rejected' && item.reason.status === 401))
    assert.equal(refreshCalls, 1)
    assert.ok(env.dispatched.includes('texcore:session-expired'))
    await assert.rejects(() => apiGet('/api/tres/'))
    assert.equal(refreshCalls, 2) // la promesa en vuelo se liberó: no queda atascada
  } finally {
    env.restore()
  }
})
