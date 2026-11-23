import { useCallback, useEffect, useState } from 'react'
import { apiGet } from '../../api/client'
import { buildLogQuery } from './logs'

/** Carga una lista paginada de registros (accesos o auditoría) y la recarga al cambiar filtros o página. */
export default function useLogList(path, filters) {
  const filtersKey = JSON.stringify(filters)
  // La página se guarda junto con los filtros a los que pertenece: un filtro nuevo vuelve a la primera.
  const [pageState, setPageState] = useState({ key: filtersKey, page: 1 })
  const page = pageState.key === filtersKey ? pageState.page : 1
  const setPage = useCallback((next) => setPageState({ key: filtersKey, page: next }), [filtersKey])
  const [data, setData] = useState({ count: 0, results: [] })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      setData(await apiGet(`${path}${buildLogQuery(JSON.parse(filtersKey), page)}`))
      setError('')
    } catch (failure) {
      setError(failure.message)
    } finally {
      setLoading(false)
    }
  }, [path, filtersKey, page])

  useEffect(() => {
    load()
  }, [load])

  return { data, loading, error, page, setPage, reload: load }
}
