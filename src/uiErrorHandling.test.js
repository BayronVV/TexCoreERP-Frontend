import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

import { ApiError, apiGet } from './api/client.js'

const SRC_DIR = dirname(fileURLToPath(import.meta.url))

const CRITICAL_PAGES = [
  { file: 'components/Laundry/LaundryRemissionPage.jsx', clearPattern: /setAvailableLots\(\[\]\)/, errorPattern: /loadError/ },
  { file: 'components/Laundry/LaundryReceptionPage.jsx', clearPattern: /setPendingRemissions\(\[\]\)/, errorPattern: /loadError/ },
  { file: 'components/Quality/InspectionsPage.jsx', clearPattern: /setHistoryPage\(null\)/, errorPattern: /loadError/ },
  { file: 'components/Finished/EntryPage.jsx', clearPattern: /setPending\(null\)/, errorPattern: /loadError/ },
  { file: 'components/Finished/StockPage.jsx', clearPattern: /setMatrix\(null\)/, errorPattern: /loadError/ },
  { file: 'components/Finished/AdjustmentPage.jsx', clearPattern: /setHistory\(null\)/, errorPattern: /loadError/ },
  { file: 'components/Finished/MovementsPage.jsx', clearPattern: /setPageData\(null\)/, errorPattern: /loadError/ },
  { file: 'components/Sales/SalePage.jsx', clearPattern: /setLoadError/, errorPattern: /loadError/ },
  { file: 'components/Sales/CarteraPage.jsx', clearPattern: /setPageData\(null\)/, errorPattern: /loadError/ },
  { file: 'components/Sales/InvoicesPage.jsx', clearPattern: /setPageData\(null\)/, errorPattern: /loadError/ },
  { file: 'components/Sales/PricesPage.jsx', clearPattern: /setRows\(null\)/, errorPattern: /loadError/ },
  { file: 'components/Sales/SalesPanel.jsx', clearPattern: /setPanel\(null\)/, errorPattern: /loadError/ },
  { file: 'components/Shipping/GuidesPage.jsx', clearPattern: /setPageData\(null\)/, errorPattern: /loadError/ },
  { file: 'components/Shipping/ShippingPanel.jsx', clearPattern: /setSummary\(null\)/, errorPattern: /loadError/ },
  { file: 'components/Reports/ReportsPage.jsx', clearPattern: /setReport\(null\)/, errorPattern: /error\s*&&/ },
]

test('TE-187: apiGet propaga errores HTTP 403/500/503 y pérdida de red sin caer en datos simulados', async () => {
  const prevFetch = globalThis.fetch
  const prevStorage = globalThis.localStorage
  const store = new Map([['access_token', 'tok']])
  globalThis.localStorage = {
    getItem: (k) => store.get(k) ?? null,
    setItem: (k, v) => store.set(k, String(v)),
    removeItem: (k) => store.delete(k),
  }

  try {
    for (const [status, detail] of [
      [403, 'Sin permiso para consultar reportes.'],
      [500, 'Ocurrió un error interno en el servidor.'],
      [503, 'El servicio de rastreo no respondió.'],
    ]) {
      globalThis.fetch = async () => ({
        ok: false,
        status,
        json: async () => ({ detail }),
      })
      await assert.rejects(
        () => apiGet('/api/reportes/gerencial/'),
        (err) => err instanceof ApiError && err.status === status && err.message === detail,
      )
    }

    globalThis.fetch = async () => {
      throw new TypeError('Failed to fetch')
    }
    await assert.rejects(
      () => apiGet('/api/terminado/existencias/'),
      (err) => err instanceof ApiError && err.status === 0 && /conexión|conectar/i.test(err.message),
    )
  } finally {
    globalThis.fetch = prevFetch
    globalThis.localStorage = prevStorage
  }
})

test('TE-187: todas las pantallas críticas limpian datos obsoletos ante error y muestran el fallo', () => {
  for (const spec of CRITICAL_PAGES) {
    const content = readFileSync(join(SRC_DIR, spec.file), 'utf8')
    assert.match(content, /\.catch\(|catch\s*\(/, `${spec.file} debe capturar errores de red/API`)
    assert.match(content, spec.clearPattern, `${spec.file} debe limpiar estado previo ante error`)
    assert.match(content, spec.errorPattern, `${spec.file} debe renderizar el mensaje de error`)
    assert.doesNotMatch(content, /mockData|MOCK_|FAKE_DATA|datosSimulados/i, `${spec.file} no debe usar datos simulados`)
  }
})
