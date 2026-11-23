import test from 'node:test'
import assert from 'node:assert/strict'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { assertApiUrl, MISSING_API_URL_MESSAGE } from '../vite.config.js'

// Regla del equipo: los atajos de desarrollo no llegan a `pruebas` ni a `main`.
function sourceFiles(dir) {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name)
    if (statSync(path).isDirectory()) return sourceFiles(path)
    return /\.(jsx?|css)$/.test(name) && !/\.test\.js$/.test(name) ? [path] : []
  })
}

test('ningún archivo de src usa el acceso simulado mock_dev_token', () => {
  const offenders = sourceFiles('src').filter((file) => readFileSync(file, 'utf8').includes('mock_dev_token'))
  assert.deepEqual(offenders, [])
})

test('el build de producción exige VITE_API_URL con un mensaje claro', () => {
  assert.throws(() => assertApiUrl('production', {}), { message: MISSING_API_URL_MESSAGE })
  assert.throws(() => assertApiUrl('production', { VITE_API_URL: '   ' }), /VITE_API_URL/)
})

test('con VITE_API_URL el build de producción sigue funcionando y el desarrollo no la exige', () => {
  assert.doesNotThrow(() => assertApiUrl('production', { VITE_API_URL: 'https://texcore-api.onrender.com' }))
  assert.doesNotThrow(() => assertApiUrl('development', {}))
})
