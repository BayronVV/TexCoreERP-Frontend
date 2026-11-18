import fs from 'node:fs'
import path from 'node:path'
import test from 'node:test'
import assert from 'node:assert/strict'
import { buildCanCheck, hasAccess, resolveProtectedRoute } from './permissions.js'

test('hasAccess evalúa permisos individuales y listas de permisos', () => {
  const can = buildCanCheck({ role: 'VENDEDOR', permissions: ['ventas.ver', 'ventas.gestionar'] })
  assert.equal(hasAccess(can, 'ventas.ver'), true)
  assert.equal(hasAccess(can, 'produccion.ver'), false)
  assert.equal(hasAccess(can, ['produccion.ver', 'ventas.ver']), true)
  assert.equal(hasAccess(can, ['produccion.ver', 'calidad.ver']), false)
  assert.equal(hasAccess(null, 'ventas.ver'), false)
})

test('ADMIN tiene acceso implícito a cualquier permiso', () => {
  const canAdmin = buildCanCheck({ role: 'ADMIN', permissions: [] })
  assert.equal(hasAccess(canAdmin, 'seguridad.roles'), true)
  assert.equal(hasAccess(canAdmin, 'reportes.ver'), true)
})

test('resolveProtectedRoute distingue carga, error, pendiente, denegado y permitido', () => {
  assert.deepEqual(resolveProtectedRoute({ user: null, loadError: null, requiredCode: 'ventas.ver' }), {
    status: 'loading',
  })
  assert.deepEqual(resolveProtectedRoute({ user: null, loadError: 'Sin conexión', requiredCode: 'ventas.ver' }), {
    status: 'error',
    message: 'Sin conexión',
  })
  assert.deepEqual(
    resolveProtectedRoute({ user: { role: 'PENDING', permissions: [] }, requiredCode: 'ventas.ver' }),
    { status: 'pending' },
  )
  assert.deepEqual(
    resolveProtectedRoute({
      user: { role: 'VENDEDOR', permissions: ['ventas.ver'] },
      requiredCode: 'reportes.ver',
    }),
    { status: 'forbidden' },
  )
  assert.deepEqual(
    resolveProtectedRoute({
      user: { role: 'GERENTE', permissions: ['reportes.ver'] },
      requiredCode: 'reportes.ver',
    }),
    { status: 'allowed' },
  )
})

test('AuthContext y RequirePermission usan el manejo de sesiones y el bloqueo por permiso', () => {
  const requirePermissionSrc = fs.readFileSync(
    path.resolve(import.meta.dirname, '../components/ui/RequirePermission.jsx'),
    'utf8',
  )
  assert.match(requirePermissionSrc, /hasAccess\(can, code\)/)
  assert.match(requirePermissionSrc, /No tienes acceso a esta sección/)

  const appLayoutSrc = fs.readFileSync(
    path.resolve(import.meta.dirname, '../components/Layout/AppLayout.jsx'),
    'utf8',
  )
  assert.match(appLayoutSrc, /user\.role === 'PENDING'/)
  assert.match(appLayoutSrc, /pendiente de aprobación/)
})
