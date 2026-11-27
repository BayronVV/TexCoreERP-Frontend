import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  countActiveFilters,
  readInitialFilters,
  serializeFiltersToParams,
} from './usePersistedFilters.js'

const DEFAULTS = { q: '', estado: '', desde: '', hasta: '', todas: false }

describe('Persistencia de filtros combinables (TE-177)', () => {
  it('readInitialFilters prioriza la URL sobre sessionStorage y defaults', () => {
    const stored = JSON.stringify({
      filters: { q: 'viejo', estado: 'ANULADA', desde: '', hasta: '', todas: false },
      page: 3,
      pageSize: 25,
    })
    const fromUrl = readInitialFilters(DEFAULTS, 'estado=EMITIDA&todas=1&page=2', stored)
    assert.equal(fromUrl.filters.estado, 'EMITIDA')
    assert.equal(fromUrl.filters.todas, true)
    assert.equal(fromUrl.filters.q, '')
    assert.equal(fromUrl.page, 2)
  })

  it('readInitialFilters restaura sessionStorage cuando la URL no trae filtros', () => {
    const stored = JSON.stringify({
      filters: { q: 'FV-0010', estado: 'PAGADO', desde: '2026-11-01', hasta: '', todas: false },
      page: 4,
      pageSize: 100,
    })
    const restored = readInitialFilters(DEFAULTS, '', stored)
    assert.equal(restored.filters.q, 'FV-0010')
    assert.equal(restored.filters.estado, 'PAGADO')
    assert.equal(restored.filters.desde, '2026-11-01')
    assert.equal(restored.page, 4)
    assert.equal(restored.pageSize, 100)
  })

  it('serializeFiltersToParams omite vacíos y conserva parámetros extra', () => {
    const params = serializeFiltersToParams(
      { q: '  jean ', estado: '', desde: '2026-11-01', hasta: '', todas: true },
      2,
      50,
      DEFAULTS,
      50,
      { vista: 'kardex' },
    )
    assert.equal(params.get('vista'), 'kardex')
    assert.equal(params.get('q'), 'jean')
    assert.equal(params.get('desde'), '2026-11-01')
    assert.equal(params.get('todas'), '1')
    assert.equal(params.get('page'), '2')
    assert.equal(params.has('estado'), false)
  })

  it('countActiveFilters cuenta solo filtros distintos al default', () => {
    assert.equal(countActiveFilters({ ...DEFAULTS }, DEFAULTS), 0)
    assert.equal(countActiveFilters({ ...DEFAULTS, q: 'abc', todas: true }, DEFAULTS), 2)
  })
})
