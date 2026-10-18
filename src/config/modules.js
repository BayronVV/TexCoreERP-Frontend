// Módulos del menú lateral: solo etiquetas y rutas. Qué ve cada rol lo decide
// el backend; un módulo se muestra si el usuario tiene el permiso "<id>.ver".
// `hidden`: el módulo no aparece en el menú, pero sigue existiendo para sus permisos (la pantalla de roles los agrupa por él).

export const MODULES = [
  {
    id: 'seguridad',
    label: 'Seguridad y Usuarios',
    children: [
      { label: 'Usuarios', path: '/seguridad/usuarios' },
      { label: 'Roles y permisos', path: '/seguridad/roles' },
    ],
  },
  {
    id: 'inventario',
    label: 'Inventario de Materias Primas',
    children: [
      { label: 'Movimientos', path: '/inventario' },
      { label: 'Catálogo', path: '/inventario/catalogo' },
      { label: 'Proveedores', path: '/inventario/proveedores' },
    ],
  },
  {
    id: 'compras',
    label: 'Compras',
    children: [
      { label: 'Órdenes de compra', path: '/compras/ordenes' },
      { label: 'Recepción de mercancía', path: '/compras/recepcion' },
    ],
  },
  {
    id: 'referencias',
    label: 'Referencias de Jean',
    children: [{ label: 'Catálogo de jeans', path: '/referencias' }],
  },
  // La ficha técnica se edita dentro del Catálogo de jeans (botón «Ficha técnica»); no hay una pantalla aparte.
  { id: 'fichas_tecnicas', label: 'Fichas Técnicas', hidden: true },
  {
    id: 'produccion',
    label: 'Producción y Trazabilidad',
    children: [
      { label: 'Órdenes de producción', path: '/produccion/ordenes' },
      { label: 'Monitor de estado', path: '/produccion/monitor' },
      { label: 'Recursos', path: '/produccion/recursos' },
      { label: 'Liquidación de Órdenes', path: '/produccion/liquidacion' },
    ],
  },
  { id: 'lavanderia', label: 'Procesos Externos (Lavandería)' },
  { id: 'calidad', label: 'Control de Calidad' },
  { id: 'producto_terminado', label: 'Producto Terminado' },
  { id: 'ventas', label: 'Ventas y Despachos' },
  { id: 'reportes', label: 'Reportes' },
]
