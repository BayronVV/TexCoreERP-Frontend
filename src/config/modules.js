// Módulos del menú lateral: solo etiquetas y rutas. Qué ve cada rol lo decide
// el backend; un módulo se muestra si el usuario tiene el permiso "<id>.ver".
// `anyOf`: módulo sin permisos propios que se muestra con cualquiera de esos permisos (Trazabilidad, HU 7.6).
// `hidden`: el módulo no aparece en el menú, pero sigue existiendo para sus permisos (la pantalla de roles los agrupa por él).

import { TRACE_PERMISSIONS } from '../components/Traceability/trace.js'

export const MODULES = [
  {
    id: 'seguridad',
    label: 'Seguridad y Usuarios',
    children: [
      { label: 'Usuarios', path: '/seguridad/usuarios', permission: 'seguridad.ver' },
      { label: 'Roles y permisos', path: '/seguridad/roles', permission: 'seguridad.ver' },
      // `permission`: la opción solo aparece si el rol tiene ese permiso (el módulo se ve con "<id>.ver").
      { label: 'Accesos', path: '/seguridad/accesos', permission: 'seguridad.accesos' },
      { label: 'Auditoría', path: '/seguridad/auditoria', permission: 'seguridad.auditoria' },
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
  {
    id: 'lavanderia',
    label: 'Procesos Externos (Lavandería)',
    children: [
      { label: 'Remisión a Lavado', path: '/lavanderia/remisiones' },
      { label: 'Recepción de Lavandería', path: '/lavanderia/recepcion' },
    ],
  },
  {
    id: 'calidad',
    label: 'Control de Calidad',
    children: [
      { label: 'Inspecciones', path: '/calidad/inspecciones' },
      { label: 'Defectos', path: '/calidad/defectos' },
    ],
  },
  {
    id: 'producto_terminado',
    label: 'Producto Terminado',
    children: [
      { label: 'Ingreso', path: '/producto-terminado/ingreso' },
      { label: 'Existencias', path: '/producto-terminado/existencias' },
      { label: 'Ajuste manual', path: '/producto-terminado/ajuste' },
      { label: 'Movimientos', path: '/producto-terminado/movimientos' },
    ],
  },
  {
    id: 'ventas',
    label: 'Ventas y Despachos',
    children: [
      { label: 'Panel de ventas', path: '/ventas/panel' },
      { label: 'Nueva venta', path: '/ventas/nueva' },
      { label: 'Gestión de cartera', path: '/ventas/cartera' },
      { label: 'Facturas', path: '/ventas/facturas' },
      { label: 'Clientes', path: '/ventas/clientes' },
      { label: 'Precios', path: '/ventas/precios' },
    ],
  },
  {
    id: 'envios',
    label: 'Envíos',
    children: [
      { label: 'Panel de envíos', path: '/envios/panel' },
      { label: 'Guías', path: '/envios/guias' },
      { label: 'Por despachar', path: '/envios/pendientes' },
      { label: 'Relaciones de despacho', path: '/envios/relaciones' },
    ],
  },
  {
    id: 'reportes',
    label: 'Reportes',
    children: [{ label: 'Tablero gerencial', path: '/reportes' }],
  },
  // Sin permiso propio: el servidor muestra a cada rol solo los bloques de los módulos que puede consultar.
  { id: 'trazabilidad', label: 'Trazabilidad', path: '/trazabilidad', anyOf: TRACE_PERMISSIONS },
]

/**
 * ¿El menú muestra este módulo? Con `<id>.ver`, o porque el rol tiene el permiso de alguna de sus opciones
 * (p. ej. el Gerente consulta la auditoría sin poder ver usuarios).
 *
 * @param {{id: string, anyOf?: string[], children?: Array<{permission?: string}>}} module
 * @param {(code: string) => boolean} can
 */
export function isVisible(module, can) {
  if (module.anyOf) return module.anyOf.some((code) => can(code))
  return can(`${module.id}.ver`) || Boolean(module.children?.some((child) => child.permission && can(child.permission)))
}
