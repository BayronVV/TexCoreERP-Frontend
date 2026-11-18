import fs from 'node:fs'
import path from 'node:path'
import test from 'node:test'
import assert from 'node:assert/strict'
import { MODULES } from './modules.js'

const appSource = fs.readFileSync(path.resolve(import.meta.dirname, '../App.jsx'), 'utf8')
const sidebarSource = fs.readFileSync(path.resolve(import.meta.dirname, '../components/Sidebar/Sidebar.jsx'), 'utf8')

/** Extrae todas las rutas protegidas de App.jsx junto con su código en `<RequirePermission code="...">`. */
function extractRoutes(source) {
  const routes = new Map()
  const blockRegex = /<Route\s+path="([^"]+)"\s+element=\{([\s\S]*?)\}\s*\/>/g
  for (const match of source.matchAll(blockRegex)) {
    const [, routePath, elementBody] = match
    const permMatch = elementBody.match(/<RequirePermission\s+code=(?:"([^"]+)"|\{\[([^\]]+)\]\})/)
    const codes = permMatch
      ? permMatch[1]
        ? [permMatch[1]]
        : [...permMatch[2].matchAll(/['"]([^'"]+)['"]/g)].map((m) => m[1])
      : []
    routes.set(routePath, codes)
  }
  return routes
}

test('todas las rutas declaradas en el menú lateral (MODULES) existen en App.jsx y exigen permiso del módulo', () => {
  const routes = extractRoutes(appSource)
  const visibleModules = MODULES.filter((m) => !m.hidden)
  assert.ok(visibleModules.length >= 10)

  for (const mod of visibleModules) {
    const items = mod.children || (mod.path ? [{ label: mod.label, path: mod.path }] : [])
    assert.ok(items.length > 0, `El módulo visible ${mod.id} debe tener rutas configuradas`)

    for (const item of items) {
      assert.ok(
        routes.has(item.path),
        `La ruta "${item.path}" del menú (${mod.id} -> ${item.label}) no existe en App.jsx`,
      )
      const codes = routes.get(item.path)
      assert.ok(
        codes.length > 0,
        `La ruta "${item.path}" en App.jsx debe estar protegida con <RequirePermission>`,
      )
      assert.ok(
        codes.some((code) => code.startsWith(`${mod.id}.`)),
        `La ruta "${item.path}" exige ${codes.join(', ')}, que no pertenece al módulo "${mod.id}"`,
      )
    }
  }
})

test('Sidebar filtra módulos con `<module.id>.ver` y omite los marcados como hidden', () => {
  assert.match(sidebarSource, /!module\.hidden && can\(`\$\{module\.id\}\.ver`\)/)
})
