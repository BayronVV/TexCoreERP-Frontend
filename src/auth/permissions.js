/**
 * Evalúa si el usuario tiene acceso según un permiso único o una lista de permisos alternativos.
 *
 * @param {(code: string) => boolean} can Función de permisos proveniente de `useAuth()`.
 * @param {string|string[]} code Código o arreglo de códigos de permiso aceptados.
 * @returns {boolean}
 */
export function hasAccess(can, code) {
  if (typeof can !== 'function' || !code) return false
  return Array.isArray(code) ? code.some((c) => can(c)) : can(code)
}

/**
 * Crea el predicado de permisos de sesión a partir del usuario cargado por `/api/auth/me/`.
 * Refleja la lógica de `AuthProvider`: ADMIN tiene todos los permisos de forma implícita.
 *
 * @param {{role?: string, permissions?: string[]}|null|undefined} user
 * @returns {(code: string) => boolean}
 */
export function buildCanCheck(user) {
  const permissions = new Set(user?.permissions ?? [])
  return (code) => user?.role === 'ADMIN' || permissions.has(code)
}

/**
 * Determina el resultado de navegación en el marco autenticado (`AppLayout` + `RequirePermission`).
 */
export function resolveProtectedRoute({ user, loadError, requiredCode }) {
  if (loadError) return { status: 'error', message: loadError }
  if (!user) return { status: 'loading' }
  if (user.role === 'PENDING') return { status: 'pending' }
  const can = buildCanCheck(user)
  if (requiredCode && !hasAccess(can, requiredCode)) {
    return { status: 'forbidden' }
  }
  return { status: 'allowed' }
}
