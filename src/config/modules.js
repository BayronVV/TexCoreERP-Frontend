// Módulos del menú lateral: solo etiquetas y rutas. Qué ve cada rol lo decide
// el backend; un módulo se habilita si el usuario tiene el permiso "<id>.ver".

export const MODULES = [
  {
    id: 'seguridad',
    label: 'Seguridad y Usuarios',
    children: [
      { label: 'Usuarios', path: '/seguridad/usuarios' },
      { label: 'Roles y permisos', path: '/seguridad/roles' },
    ],
  },
  { id: 'inventario', label: 'Inventario de Materias Primas', path: '/inventario' },
  { id: 'fichas_tecnicas', label: 'Fichas Técnicas' },
  { id: 'produccion', label: 'Producción y Trazabilidad' },
  { id: 'lavanderia', label: 'Procesos Externos (Lavandería)' },
  { id: 'calidad', label: 'Control de Calidad' },
  { id: 'producto_terminado', label: 'Producto Terminado' },
  { id: 'ventas', label: 'Ventas y Despachos' },
  { id: 'reportes', label: 'Reportes' },
]
