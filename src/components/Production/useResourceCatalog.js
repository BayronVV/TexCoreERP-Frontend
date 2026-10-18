import { useCallback, useEffect, useState } from 'react'
import { apiGet } from '../../api/client'

/** Operarios y máquinas activos, para los menús. Se recargan con `reload` después de cada asignación (cambia dónde están ocupados). */
export function useResourceCatalog(enabled) {
  const [catalog, setCatalog] = useState({ operarios: [], maquinas: [] })
  const reload = useCallback(() => {
    if (!enabled) return
    Promise.all([apiGet('/api/produccion/operarios/?activo=1'), apiGet('/api/produccion/maquinas/?activo=1')])
      .then(([operarios, maquinas]) => setCatalog({ operarios, maquinas }))
      .catch(() => {}) // sin catálogo los menús quedan vacíos; asignar igualmente lo valida el servidor
  }, [enabled])
  useEffect(() => {
    reload()
  }, [reload])
  return { catalog, reload }
}
