// Fuente única del mapa rol → módulo (HU 1.4 / TE-75).
// Debe reflejar exactamente apps/core/constants.ROLE_MODULES del backend
// (basado en el diagrama de casos de uso del negocio). Si cambias uno,
// cambia el otro.

export const MODULES = [
  { id: 'seguridad', label: 'Seguridad y Usuarios', path: '/dashboard', ready: true },
  { id: 'inventario', label: 'Inventario de Materias Primas', path: null, ready: false },
  { id: 'fichas_tecnicas', label: 'Fichas Técnicas', path: null, ready: false },
  { id: 'produccion', label: 'Producción y Trazabilidad', path: null, ready: false },
  { id: 'lavanderia', label: 'Procesos Externos (Lavandería)', path: null, ready: false },
  { id: 'calidad', label: 'Control de Calidad', path: null, ready: false },
  { id: 'producto_terminado', label: 'Producto Terminado', path: null, ready: false },
  { id: 'ventas', label: 'Ventas y Despachos', path: null, ready: false },
  { id: 'reportes', label: 'Reportes', path: null, ready: false },
]

export const ROLE_MODULES = {
  ADMIN: ['*'],
  ALMACENISTA: ['inventario'],
  PRODUCCION: ['fichas_tecnicas', 'produccion', 'lavanderia'],
  TERMINACION: ['calidad'],
  SECRETARIA: ['producto_terminado'],
  VENDEDOR: ['ventas'],
  GERENTE: ['reportes'],
  PENDING: [],
}

export function hasModuleAccess(role, moduleId) {
  const allowed = ROLE_MODULES[role] || []
  return allowed.includes('*') || allowed.includes(moduleId)
}
