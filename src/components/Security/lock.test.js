import test from 'node:test'
import assert from 'node:assert/strict'
import { isLocked } from './lock.js'

test('isLocked solo es verdadero mientras el bloqueo siga vigente', () => {
  const now = Date.parse('2026-11-22T12:00:00Z')
  assert.equal(isLocked({ locked_until: '2026-11-22T12:10:00Z' }, now), true)
  assert.equal(isLocked({ locked_until: '2026-11-22T11:59:00Z' }, now), false)
  assert.equal(isLocked({ locked_until: null }, now), false)
  assert.equal(isLocked(undefined, now), false)
})
