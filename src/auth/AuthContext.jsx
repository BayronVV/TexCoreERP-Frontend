import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { apiGet } from '../api/client'
import { AuthContext, clearSession } from './session'

// Los permisos vienen siempre del servidor (/api/auth/me/), no del JWT: así un
// cambio de rol se ve al recargar, sin volver a iniciar sesión.
export function AuthProvider({ children }) {
  const navigate = useNavigate()
  const [user, setUser] = useState(null)
  const [loadError, setLoadError] = useState(null)

  const endSession = useCallback(() => {
    clearSession()
    navigate('/login', { replace: true })
  }, [navigate])

  const reloadUser = useCallback(async () => {
    try {
      setUser(await apiGet('/api/auth/me/'))
      setLoadError(null)
    } catch (error) {
      // Solo un 401 cierra la sesión; si el backend está caído se muestra el error.
      if (error.status === 401) endSession()
      else setLoadError(error.message)
    }
  }, [endSession])

  useEffect(() => {
    if (localStorage.getItem('access_token')) {
      reloadUser()
    } else {
      navigate('/login', { replace: true })
    }
  }, [reloadUser, navigate])

  useEffect(() => {
    window.addEventListener('texcore:session-expired', endSession)
    return () => window.removeEventListener('texcore:session-expired', endSession)
  }, [endSession])

  const value = useMemo(() => {
    const permissions = new Set(user?.permissions ?? [])
    return {
      user,
      loadError,
      reloadUser,
      logout: endSession,
      can: (code) => permissions.has(code),
    }
  }, [user, loadError, reloadUser, endSession])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
