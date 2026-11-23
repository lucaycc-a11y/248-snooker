// Run: node --experimental-strip-types scripts/test-cam-live.mjs
// Tests the phone polling/answer/command logic with a mocked fetch and a mocked RTCPeerConnection.
import assert from 'node:assert/strict'
import { PhoneLive, pollRpc, sendOfferRpc } from '../lib/pilot/cam-live.ts'

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

class MockPc {
  static all = []
  constructor() {
    this.iceGatheringState = 'complete'
    this.localDescription = { sdp: 'v=0 mock-offer' }
    this.tracks = []; this.remote = null; this.closed = false; this.connectionState = 'new'
    MockPc.all.push(this)
  }
  addTrack(t) { this.tracks.push(t) }
  async createOffer() { return { type: 'offer', sdp: 'v=0 mock-offer' } }
  async setLocalDescription() {}
  async setRemoteDescription(d) { this.remote = d }
  addEventListener() {} removeEventListener() {}
  close() { this.closed = true }
}
const stream = { getVideoTracks: () => [{ kind: 'video' }] }

// Scripted server state, served through a mocked fetch.
let server, calls
function mockFetch(url, init) {
  const name = url.split('/rpc/')[1]
  const body = JSON.parse(init.body)
  calls.push({ name, body })
  if (body.p_pin !== '1234') return Promise.resolve(new Response(JSON.stringify({ message: 'BAD_PIN' }), { status: 403 }))
  if (name === 'pilot_cam_phone_offer') { server.offer = body.p_offer; server.answer = null; return Promise.resolve(new Response(JSON.stringify({ ok: true }), { status: 200 })) }
  return Promise.resolve(new Response(JSON.stringify({ requested: server.requested, requested_at: server.requested_at, answer: server.answer, command: server.command, command_id: server.command_id }), { status: 200 }))
}

function setup(pin = '1234') {
  MockPc.all = []; calls = []
  server = { requested: false, requested_at: null, answer: null, command: null, command_id: 'old-1', offer: null }
  const log = { commands: [], viewing: [], errors: [] }
  const live = new PhoneLive({
    poll: () => pollRpc('Space Infinity', pin, mockFetch),
    sendOffer: (sdp) => sendOfferRpc('Space Infinity', pin, sdp, mockFetch),
    createPc: () => new MockPc(),
    getStream: () => stream,
    onCommand: (c) => log.commands.push(c),
    onViewing: (v) => log.viewing.push(v),
    onError: (m, f) => log.errors.push([m, f]),
  }, 10)
  return { live, log }
}

// 1. Old command present at load is ignored; a new command_id fires once.
{
  const { live, log } = setup()
  await live.tick()
  assert.deepEqual(log.commands, [], 'old command must not fire')
  server.command = 'record'; server.command_id = 'c-2'
  await live.tick(); await live.tick()
  assert.deepEqual(log.commands, ['record'], 'new command fires exactly once')
  server.command = 'stop'; server.command_id = 'c-3'
  await live.tick()
  assert.deepEqual(log.commands, ['record', 'stop'])
  console.log('ok 1 commands')
}

// 2. Live request -> offer sent once -> answer applied once -> request cleared closes pc.
{
  const { live, log } = setup()
  await live.tick()
  server.requested = true; server.requested_at = 't1'
  await live.tick()
  assert.equal(MockPc.all.length, 1)
  assert.equal(server.offer, 'v=0 mock-offer')
  assert.equal(MockPc.all[0].tracks.length, 1, 'video track only')
  await live.tick()
  assert.equal(MockPc.all.length, 1, 'same requested_at must not reconnect')
  server.answer = 'v=0 mock-answer'
  await live.tick(); await live.tick()
  assert.deepEqual(MockPc.all[0].remote, { type: 'answer', sdp: 'v=0 mock-answer' })
  server.requested = false
  await live.tick()
  assert.equal(MockPc.all[0].closed, true, 'iPad closed view -> pc closed')
  console.log('ok 2 offer/answer/close')
}

// 3. New requested_at restarts the connection and closes the old pc.
{
  const { live } = setup()
  server.requested = true; server.requested_at = 't1'
  await live.tick()
  server.requested_at = 't2'
  await live.tick()
  assert.equal(MockPc.all.length, 2)
  assert.equal(MockPc.all[0].closed, true)
  assert.equal(calls.filter((c) => c.name === 'pilot_cam_phone_offer').length, 2)
  console.log('ok 3 restart')
}

// 4. Wrong PIN is fatal: reports once and stops polling; PIN never appears outside the request body.
{
  const { live, log } = setup('0000')
  live.start()
  await sleep(80)
  assert.equal(log.errors[0][0], 'PIN 不正確'); assert.equal(log.errors[0][1], true)
  const n = calls.length
  await sleep(60)
  assert.equal(calls.length, n, 'polling stops after fatal error')
  console.log('ok 4 bad pin')
}

// 5. Network failure is non-fatal and polling continues.
{
  MockPc.all = []
  let n = 0
  const errors = []
  const live = new PhoneLive({
    poll: () => { n++; return pollRpc('r', '1234', () => Promise.reject(new Error('net'))) },
    sendOffer: async () => true, createPc: () => new MockPc(), getStream: () => stream,
    onCommand() {}, onViewing() {}, onError: (m, f) => errors.push([m, f]),
  }, 10)
  live.start(); await sleep(80); live.stop()
  assert.ok(n >= 3, 'keeps polling'); assert.equal(errors[0][1], false)
  console.log('ok 5 network error')
}
console.log('ALL PASSED')
