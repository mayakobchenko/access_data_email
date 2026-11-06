import test from 'node:test'
import assert from 'node:assert/strict'
import crypto from 'node:crypto'
import { signatureValid, bearerValid, webhookAllowed } from '../src/webhookAuth.js'
import { createHandledTickets } from '../src/handledTickets.js'

const body = Buffer.from(JSON.stringify({ ticket_id: 42 }))
const sig = (secret, b = body) => crypto.createHmac('sha1', secret).update(b).digest('hex')

test('signature: "sha1=<hex>" and bare hex are accepted, a wrong one is not', () => {
  assert.equal(signatureValid(body, 'sha1=' + sig('s3cret'), 's3cret'), true)
  assert.equal(signatureValid(body, sig('s3cret'), 's3cret'), true)
  assert.equal(signatureValid(body, 'sha1=' + sig('other'), 's3cret'), false)
  assert.equal(signatureValid(Buffer.from('{"ticket_id":43}'), 'sha1=' + sig('s3cret'), 's3cret'), false)
  assert.equal(signatureValid(body, undefined, 's3cret'), false)
  assert.equal(signatureValid(body, 'sha1=' + sig('s3cret'), ''), false)
})

test('bearer token', () => {
  assert.equal(bearerValid('Bearer abc', 'abc'), true)
  assert.equal(bearerValid('Bearer abd', 'abc'), false)
  assert.equal(bearerValid(undefined, 'abc'), false)
})

test('webhookAllowed: open when nothing is configured, otherwise one valid check is needed', () => {
  const req = (headers) => ({ rawBody: body, headers })
  assert.equal(webhookAllowed(req({}), {}), true)
  assert.equal(webhookAllowed(req({}), { secret: 's' }), false)
  assert.equal(webhookAllowed(req({ 'x-hub-signature': 'sha1=' + sig('s') }), { secret: 's' }), true)
  assert.equal(webhookAllowed(req({ authorization: 'Bearer t' }), { secret: 's', bearer: 't' }), true)
  assert.equal(webhookAllowed(req({ authorization: 'Bearer x' }), { secret: 's', bearer: 't' }), false)
})

test('a ticket is handled once; after a failure it can be tried again; old entries expire', () => {
  let t = 0
  const h = createHandledTickets({ ttlMs: 1000, max: 3, now: () => t })
  assert.equal(h.claim(1), true)
  assert.equal(h.claim('1'), false)
  h.release(1)
  assert.equal(h.claim(1), true)
  t = 2000
  assert.equal(h.claim(1), true)
  ;[2, 3, 4, 5].forEach(i => h.claim(i))   // more than max: the oldest are forgotten
  assert.equal(h.claim(2), true)
})
