import { useCallback, useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'

export const DEFAULT_PAGE_SIZE = 50

function normalizeValue(defaultVal, rawVal) {
  if (typeof defaultVal === 'boolean') {
    if (typeof rawVal === 'boolean') return rawVal
    return rawVal === '1' || rawVal === 'true'
  }
  return rawVal == null ? '' : String(rawVal)
}

/**
 * Lee el estado inicial de `{ filters, page, pageSize }` dando prioridad a:
 * 1) Parámetros presentes en la URL (`search`),
 * 2) Última selección guardada en `sessionStorage` (`storedRaw`),
 * 3) Valores por defecto (`defaults`).
 */
export function readInitialFilters(defaults, search = '', storedRaw = null, defaultPageSize = DEFAULT_PAGE_SIZE) {
  const urlParams = new URLSearchParams(search)
  const filterKeys = Object.keys(defaults)
  const hasUrlFilter =
    filterKeys.some((key) => urlParams.has(key)) || urlParams.has('page') || urlParams.has('page_size')

  if (hasUrlFilter) {
    const filters = {}
    for (const key of filterKeys) {
      filters[key] = urlParams.has(key)
        ? normalizeValue(defaults[key], urlParams.get(key))
        : defaults[key]
    }
    const rawPage = Number(urlParams.get('page'))
    const rawSize = Number(urlParams.get('page_size'))
    return {
      filters,
      page: Number.isInteger(rawPage) && rawPage >= 1 ? rawPage : 1,
      pageSize: Number.isInteger(rawSize) && rawSize >= 1 && rawSize <= 200 ? rawSize : defaultPageSize,
    }
  }

  if (storedRaw) {
    try {
      const parsed = JSON.parse(storedRaw)
      if (parsed && typeof parsed === 'object' && parsed.filters) {
        const filters = {}
        for (const key of filterKeys) {
          filters[key] =
            key in parsed.filters ? normalizeValue(defaults[key], parsed.filters[key]) : defaults[key]
        }
        const rawPage = Number(parsed.page)
        const rawSize = Number(parsed.pageSize)
        return {
          filters,
          page: Number.isInteger(rawPage) && rawPage >= 1 ? rawPage : 1,
          pageSize: Number.isInteger(rawSize) && rawSize >= 1 && rawSize <= 200 ? rawSize : defaultPageSize,
        }
      }
    } catch {
      // Si el almacenamiento local está corrupto se ignora y se usan los valores por defecto.
    }
  }

  return { filters: { ...defaults }, page: 1, pageSize: defaultPageSize }
}

/**
 * Serializa únicamente los filtros distintos del valor por defecto (y página > 1) a `URLSearchParams`.
 */
export function serializeFiltersToParams(
  filters,
  page = 1,
  pageSize = DEFAULT_PAGE_SIZE,
  defaults = {},
  defaultPageSize = DEFAULT_PAGE_SIZE,
  extraEntries = {},
) {
  const params = new URLSearchParams()
  for (const [k, v] of Object.entries(extraEntries)) {
    if (v != null && String(v) !== '') params.set(k, String(v))
  }
  for (const [key, defaultVal] of Object.entries(defaults)) {
    const val = filters[key]
    if (typeof defaultVal === 'boolean') {
      if (Boolean(val) !== defaultVal) params.set(key, val ? '1' : '0')
    } else {
      const text = String(val ?? '').trim()
      if (text !== '' && text !== String(defaultVal ?? '')) {
        params.set(key, text)
      }
    }
  }
  if (page > 1) params.set('page', String(page))
  if (pageSize !== defaultPageSize) params.set('page_size', String(pageSize))
  return params
}

/**
 * Cuenta cuántos filtros están activos respecto a `defaults`.
 */
export function countActiveFilters(filters, defaults = {}) {
  let total = 0
  for (const [key, defaultVal] of Object.entries(defaults)) {
    const val = filters[key]
    if (typeof defaultVal === 'boolean') {
      if (Boolean(val) !== defaultVal) total += 1
    } else if (String(val ?? '').trim() !== '' && String(val ?? '').trim() !== String(defaultVal ?? '')) {
      total += 1
    }
  }
  return total
}

function safeSessionGet(key) {
  try {
    return typeof window !== 'undefined' ? window.sessionStorage.getItem(key) : null
  } catch {
    return null
  }
}

function safeSessionSet(key, value) {
  try {
    if (typeof window !== 'undefined') window.sessionStorage.setItem(key, value)
  } catch {
    // Ignorar errores de cuota o navegación privada.
  }
}

function safeSessionRemove(key) {
  try {
    if (typeof window !== 'undefined') window.sessionStorage.removeItem(key)
  } catch {
    // Ignorar errores de acceso al almacenamiento.
  }
}

/**
 * Hook reutilizable para filtros combinables persistentes entre vistas (URL + sessionStorage),
 * limpieza en un clic y manejo de paginación.
 */
export function usePersistedFilters(storageKey, defaults, options = {}) {
  const { defaultPageSize = DEFAULT_PAGE_SIZE, preserveParams = [] } = options
  const [searchParams, setSearchParams] = useSearchParams()
  const [state, setState] = useState(() =>
    readInitialFilters(defaults, searchParams.toString(), safeSessionGet(storageKey), defaultPageSize),
  )

  const preserveKey = preserveParams.join('|')
  const defaultsKey = JSON.stringify(defaults)

  useEffect(() => {
    const parsedDefaults = JSON.parse(defaultsKey)
    const keysToPreserve = preserveKey ? preserveKey.split('|') : []
    const extra = {}
    for (const k of keysToPreserve) {
      if (searchParams.has(k)) extra[k] = searchParams.get(k)
    }
    const nextParams = serializeFiltersToParams(
      state.filters,
      state.page,
      state.pageSize,
      parsedDefaults,
      defaultPageSize,
      extra,
    )
    const nextString = nextParams.toString()
    if (nextString !== searchParams.toString()) {
      setSearchParams(nextParams, { replace: true })
    }
    safeSessionSet(storageKey, JSON.stringify(state))
  }, [state, storageKey, defaultsKey, defaultPageSize, preserveKey, searchParams, setSearchParams])

  const setFilter = useCallback((field, value) => {
    setState((prev) => ({
      ...prev,
      page: 1,
      filters: { ...prev.filters, [field]: value },
    }))
  }, [])

  const updateFilters = useCallback((updater) => {
    setState((prev) => ({
      ...prev,
      page: 1,
      filters: typeof updater === 'function' ? updater(prev.filters) : { ...prev.filters, ...updater },
    }))
  }, [])

  const setPage = useCallback((nextPage) => {
    setState((prev) => ({ ...prev, page: Math.max(1, Number(nextPage) || 1) }))
  }, [])

  const setPageSize = useCallback((nextSize) => {
    setState((prev) => ({ ...prev, page: 1, pageSize: Math.max(1, Number(nextSize) || defaultPageSize) }))
  }, [defaultPageSize])

  const clearFilters = useCallback(() => {
    const parsedDefaults = JSON.parse(defaultsKey)
    safeSessionRemove(storageKey)
    setState({ filters: { ...parsedDefaults }, page: 1, pageSize: defaultPageSize })
  }, [storageKey, defaultsKey, defaultPageSize])

  const activeCount = useMemo(
    () => countActiveFilters(state.filters, JSON.parse(defaultsKey)),
    [state.filters, defaultsKey],
  )

  return {
    filters: state.filters,
    page: state.page,
    pageSize: state.pageSize,
    activeCount,
    setFilter,
    updateFilters,
    setPage,
    setPageSize,
    clearFilters,
  }
}
