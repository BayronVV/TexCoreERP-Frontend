import test from 'node:test'
import assert from 'node:assert/strict'

import {
  agoText, canRegisterReturn, canTrack, colorKey, colorLabel, cooldownText, deliveredAwaitingPayment, deliveredNotice, dispatchBody,
  dispatchConfirmation, dispatchable, dispatchProblems, groupPending, guideBody, guideProblems, hoursWithoutGuide, money, noteProblem,
  pendingCounts, quotaLow, quotaText, requiresNote, sortPending, stateConfirmation, toggleId, totalFreight, trackingMessage, urgencyLabel,
  urgencyMessage,
} from './shipping.js'

const meta = { estados_con_nota: ['EN_NOVEDAD', 'DEVUELTA'], nota_minima: 10, horas_atencion: 4, horas_vencida: 24, estados: [{ codigo: 'EN_TRANSITO', nombre: 'En tránsito' }] }

test('colores del semáforo: los desconocidos son grises', () => {
  assert.equal(colorKey('verde'), 'verde')
  assert.equal(colorKey('morado'), 'gris')
  assert.equal(colorKey(undefined), 'gris')
  assert.equal(colorLabel('rojo'), 'Rojo')
})

test('urgencia y horas sin guía', () => {
  assert.equal(urgencyLabel('vencida'), 'Vencida')
  assert.equal(urgencyLabel('otra'), 'A tiempo')
  assert.equal(hoursWithoutGuide(0), 'Hace menos de 1 h')
  assert.equal(hoursWithoutGuide(5.9), 'Hace 5 h')
  assert.equal(hoursWithoutGuide(24), 'Hace 1 día')
  assert.equal(hoursWithoutGuide(51), 'Hace 2 días y 3 h')
  assert.match(urgencyMessage('vencida', meta), /más de 24 h/)
  assert.match(urgencyMessage('atencion', meta), /lo antes posible/)
  assert.match(urgencyMessage('normal', meta), /lo antes posible/)
})

test('hace cuánto fue la última consulta', () => {
  const now = Date.parse('2026-11-08T12:00:00Z')
  assert.equal(agoText(null, now), 'nunca')
  assert.equal(agoText('basura', now), 'nunca')
  assert.equal(agoText('2026-11-08T11:59:30Z', now), 'hace menos de 1 min')
  assert.equal(agoText('2026-11-08T11:45:00Z', now), 'hace 15 min')
  assert.equal(agoText('2026-11-08T09:00:00Z', now), 'hace 3 h')
  assert.equal(agoText('2026-11-06T11:00:00Z', now), 'hace 2 días')
})

test('la nota es obligatoria para novedad y devolución', () => {
  assert.equal(requiresNote('EN_NOVEDAD', meta), true)
  assert.equal(requiresNote('ENTREGADA', meta), false)
  assert.equal(noteProblem('DEVUELTA', 'corta', meta), 'Explica el motivo (mínimo 10 caracteres).')
  assert.equal(noteProblem('DEVUELTA', '  el cliente no estaba  ', meta), null)
  assert.equal(noteProblem('ENTREGADA', '', meta), null)
})

test('confirmación de cambio de estado', () => {
  const text = stateConfirmation({ id: 3, numero_guia: 'A1', estado_nombre: 'Por despachar' }, 'EN_TRANSITO', meta)
  assert.match(text, /A1/)
  assert.match(text, /En tránsito/)
  assert.match(stateConfirmation({ id: 3, numero_guia: '', estado_nombre: 'X' }, 'ANULADA', meta), /#3.*deja de estar vigente/)
})

test('enfriamiento y cuota del rastreo', () => {
  assert.equal(cooldownText(0), 'Ya puedes volver a consultar.')
  assert.equal(cooldownText(30), 'Espera 30 s para volver a consultar.')
  assert.equal(cooldownText(61), 'Espera 2 min para volver a consultar.')
  assert.equal(quotaText({ restante: 38, total: 50 }), 'Cuota de rastreo: 38 restantes de 50')
  assert.equal(quotaText(null), null)
  assert.equal(quotaLow({ restante: 5, reserva: 5, total: 50 }), true)
  assert.equal(quotaLow({ restante: 30, reserva: 5, total: 50 }), false)
})

test('mensajes de los errores de rastreo', () => {
  assert.equal(trackingMessage({ status: 429, message: 'x', body: { detail: ['Consultada hace poco.'], segundos: 120 } }), 'Consultada hace poco. Espera 2 min para volver a consultar.')
  assert.equal(trackingMessage({ status: 503, body: { detail: ['Servicio caído.'] } }), 'Servicio caído.')
  assert.match(trackingMessage({ status: 503, body: null }), /no está disponible/)
  assert.equal(trackingMessage({ status: 400, body: { transportadora: ['Sin rastreo.'] } }), 'Sin rastreo.')
  assert.equal(trackingMessage({ status: 500, body: null }), null)
})

test('qué botones se muestran', () => {
  const guide = { vigente: true, estado: 'EN_TRANSITO', rastreo: { soportado: true } }
  assert.equal(canTrack(guide, true), true)
  assert.equal(canTrack(guide, false), false)
  assert.equal(canTrack({ ...guide, rastreo: { soportado: false } }, true), false)
  assert.equal(canTrack({ ...guide, estado: 'ENTREGADA' }, true), false)
  assert.equal(canRegisterReturn({ estado: 'DEVUELTA', estado_cobro: 'POR_COBRAR' }, true), true)
  assert.equal(canRegisterReturn({ estado: 'DEVUELTA', estado_cobro: 'DEVOLUCION' }, true), false)
  assert.equal(canRegisterReturn({ estado: 'DEVUELTA', estado_cobro: 'POR_COBRAR' }, false), false)
  assert.equal(deliveredAwaitingPayment({ estado: 'ENTREGADA', estado_cobro: 'POR_COBRAR' }), true)
  assert.equal(deliveredAwaitingPayment({ estado: 'ENTREGADA', estado_cobro: 'PAGADO' }), false)
  assert.equal(deliveredAwaitingPayment(null), false)
})

test('pendientes agrupados por urgencia y ordenados por antigüedad', () => {
  const rows = [
    { id: 1, urgencia: 'normal', horas_sin_guia: 1 },
    { id: 2, urgencia: 'vencida', horas_sin_guia: 30 },
    { id: 3, urgencia: 'atencion', horas_sin_guia: 6 },
    { id: 4, urgencia: 'vencida', horas_sin_guia: 50 },
  ]
  const groups = groupPending(rows)
  assert.deepEqual(groups.vencida.map((r) => r.id), [4, 2])
  assert.deepEqual(groups.atencion.map((r) => r.id), [3])
  assert.deepEqual(pendingCounts(rows), { total: 4, vencidas: 2, atencion: 1, normales: 1 })
  assert.deepEqual(sortPending(rows).map((r) => r.id), [4, 2, 3, 1])
  assert.deepEqual(pendingCounts(null), { total: 0, vencidas: 0, atencion: 0, normales: 0 })
})

test('formulario rápido de guía', () => {
  assert.deepEqual(guideBody('ENVIA', '  123 '), { transportadora: 'ENVIA', numero_guia: '123' })
  assert.deepEqual(guideProblems('', ''), ['Elige la transportadora.', 'Escribe el número de guía.'])
  assert.deepEqual(guideProblems('ENVIA', '9'), [])
})

test('relación de despacho: cuerpo y validación', () => {
  const a = { id: 1, transportadora: 'ENVIA', factura_numero: 'FV-1' }
  const b = { id: 2, transportadora: 'INTERRAPIDISIMO', factura_numero: 'FV-2' }
  assert.deepEqual(dispatchBody({ carrier: 'ENVIA', guideIds: [1, 3], token: 't', responsible: ' Ana ', notes: ' ' }), {
    transportadora: 'ENVIA', guias: [1, 3], token: 't', responsable: 'Ana', observaciones: '',
  })
  assert.equal(dispatchBody({ carrier: 'ENVIA', guideIds: [1], token: 't', date: '2026-11-08', responsible: 'x' }).fecha, '2026-11-08')
  assert.deepEqual(dispatchProblems({ carrier: 'ENVIA', selected: [], responsible: 'Ana' }), ['Marca al menos una guía.'])
  assert.deepEqual(dispatchProblems({ carrier: '', selected: [a], responsible: 'Ana' }), ['Elige la transportadora.'])
  assert.deepEqual(dispatchProblems({ carrier: 'ENVIA', selected: [a, b], responsible: 'Ana' }), ['Todas las guías de la relación deben ser de la misma transportadora.'])
  assert.deepEqual(dispatchProblems({ carrier: 'ENVIA', selected: [a], responsible: ' ' }), ['Escribe quién entrega los paquetes a la transportadora.'])
  assert.deepEqual(dispatchProblems({ carrier: 'ENVIA', selected: [a], responsible: 'Ana' }), [])
  assert.match(dispatchConfirmation('Envía', [a]), /1 guía\(s\) con Envía[\s\S]*FV-1/)
})

test('guías por despachar y selección', () => {
  const guides = [
    { id: 1, estado: 'POR_DESPACHAR', transportadora: 'ENVIA', vigente: true },
    { id: 2, estado: 'EN_TRANSITO', transportadora: 'ENVIA', vigente: true },
    { id: 3, estado: 'POR_DESPACHAR', transportadora: 'OTRA', vigente: true },
    { id: 4, estado: 'POR_DESPACHAR', transportadora: 'ENVIA', vigente: false },
  ]
  assert.deepEqual(dispatchable(guides, 'ENVIA').map((g) => g.id), [1])
  assert.deepEqual(toggleId([1], 2), [1, 2])
  assert.deepEqual(toggleId([1, 2], 1), [2])
})

test('dinero, flete y entregadas por cobrar', () => {
  assert.equal(money(12000), '$12.000')
  assert.equal(totalFreight([{ flete: 8000 }, { flete: 12000 }, {}]), 20000)
  assert.equal(deliveredNotice(0), '')
  assert.equal(deliveredNotice(1), '1 guía entregada espera confirmar el pago.')
  assert.equal(deliveredNotice(3), '3 guías entregadas esperan confirmar el pago.')
})
