import { createContext, useContext } from 'react'

/** Contexto con el usuario de la sesión: `{ user, loadError, reloadUser, logout, can }`. */
export const AuthContext = createContext(null)

/** Borra el token y el rol guardados en el navegador (cierre de sesión). */
export function clearSession() {
  localStorage.removeItem('access_token')
  localStorage.removeItem('refresh_token')
  localStorage.removeItem('user_role')
}

/**
 * Acceso al contexto de autenticación.
 * `can('inventario.ver')` indica si el rol del usuario tiene ese permiso.
 * @throws {Error} Si se usa fuera de `<AuthProvider>`.
 */
export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth debe usarse dentro de <AuthProvider>')
  return context
}
