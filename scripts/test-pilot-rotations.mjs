// Run: node --experimental-strip-types scripts/test-pilot-rotations.mjs
import assert from 'node:assert/strict'
import { parseRotations, rotationStandings, roundRobinProgress } from '../lib/member/pilot-rpc.ts'

const P = (name, side, win, me = false, uid = null) => ({ name, side, is_winner: win, is_me: me, user_id: uid, score: win ? 5 : 3 })
const m = (id, seq, a, b, sa, sb) => ({ id, seq, started_at: `2026-11-23T10:0${seq}:00Z`, score_a: sa, score_b: sb, players: [a, b] })
const raw = { enabled: true, rotations: [{ id: 'r1', style: 'roundRobin', started_at: '2026-11-23T10:00:00Z', room_name: 'Space Infinity', matches: [
  m('m3', 3, P('Cara', 0, false), P('Me', 1, true, true, 'u1'), 2, 5),
  m('m1', 1, P('Me', 0, true, true, 'u1'), P('Ben', 1, false), 5, 3),
  m('m2', 2, P('Ben', 0, false), P('Cara', 1, true), 4, 5),
] }] }
const { enabled, rotations } = parseRotations(raw)
assert.equal(enabled, true)
const r = rotations[0]
assert.deepEqual(r.matches.map((x) => x.seq), [1, 2, 3], 'matches sorted by seq')
const rows = rotationStandings(r)
assert.equal(rows[0].name, 'Me'); assert.equal(rows[0].wins, 2); assert.equal(rows[0].rank, 1); assert.equal(rows[0].mvp, true); assert.equal(rows[0].isMe, true)
assert.equal(rows[1].name, 'Cara'); assert.equal(rows[1].rank, 2); assert.equal(rows[1].mvp, false)
assert.equal(rows[2].rank, 3)
assert.deepEqual(roundRobinProgress(r), { played: 3, total: 3 })

// ties share rank and MVP
const tie = parseRotations({ enabled: true, rotations: [{ id: 'r2', style: 'winnerStays', matches: [
  m('a', 1, P('X', 0, true), P('Y', 1, false), 5, 1), m('b', 2, P('Y', 0, true), P('X', 1, false), 5, 1) ] }] }).rotations[0]
const t = rotationStandings(tie)
assert.deepEqual(t.map((x) => [x.rank, x.mvp]), [[1, true], [1, true]])
assert.equal(roundRobinProgress({ ...tie, matches: [tie.matches[0]] }).total, 1)

// disabled / garbage
assert.deepEqual(parseRotations({ enabled: false }), { enabled: false, rotations: [] })
assert.deepEqual(parseRotations(null), { enabled: false, rotations: [] })
console.log('ALL PASSED')
