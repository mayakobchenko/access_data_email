// Starts the real server with a webhook secret and checks the endpoint without calling Zammad or any other service.
import test from 'node:test'
import assert from 'node:assert/strict'
import crypto from 'node:crypto'
import { spawn } from 'node:child_process'

const PORT = 4890
let proc
test.before(async () => {
  proc = spawn('node', ['src/serverEmailAutomat.js'], { env: { ...process.env, PORT: String(PORT), WEBHOOK_SECRET: 'testsecret' }, stdio: 'ignore' })
  for (let i = 0; i < 40; i++) {
    try { if ((await fetch(`http://127.0.0.1:${PORT}/health`)).ok) return } catch { /* not yet */ }
    await new Promise(r => setTimeout(r, 150))
  }
  throw new Error('server did not start')
})
test.after(() => proc?.kill())

test('webhook: no or wrong signature is refused (401), health stays up', async () => {
  const body = JSON.stringify({ ticket_id: 1 })
  const url = `http://127.0.0.1:${PORT}/webhook`
  const headers = { 'content-type': 'application/json' }
  assert.equal((await fetch(url, { method: 'POST', headers, body })).status, 401)
  assert.equal((await fetch(url, { method: 'POST', headers: { ...headers, 'x-hub-signature': 'sha1=' + 'a'.repeat(40) }, body })).status, 401)
  assert.equal((await fetch(`http://127.0.0.1:${PORT}/health`)).status, 200)
})

test('webhook: a signed call without ticket id is accepted but ignored (no outgoing calls)', async () => {
  const body = JSON.stringify({ hello: 'x' })
  const sig = 'sha1=' + crypto.createHmac('sha1', 'testsecret').update(body).digest('hex')
  const res = await fetch(`http://127.0.0.1:${PORT}/webhook`, { method: 'POST', headers: { 'content-type': 'application/json', 'x-hub-signature': sig }, body })
  assert.equal(res.status, 200)
})
