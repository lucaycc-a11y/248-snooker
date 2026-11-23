// Phone-side live view + remote control for /cam. Pure logic (no React) so it can be tested with mocked deps.
// Signalling is by polling Supabase RPCs; no trickle ICE (the offer carries all candidates).

export type LiveCommand = 'record' | 'stop'

export type PollResult = {
  requested: boolean
  requestedAt: string | null
  answer: string | null
  command: LiveCommand | null
  commandId: string | null
}

export type PollOutcome = { ok: true; data: PollResult } | { ok: false; fatal: boolean; message: string }

export type LiveDeps = {
  poll: () => Promise<PollOutcome>
  sendOffer: (sdp: string) => Promise<boolean>
  createPc: () => RTCPeerConnection
  getStream: () => MediaStream | null
  onCommand: (cmd: LiveCommand) => void
  onViewing: (viewing: boolean) => void
  onError: (message: string, fatal: boolean) => void
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null
}

export function parsePoll(v: unknown): PollResult | null {
  if (!isRecord(v)) return null
  const cmd = v.command === 'record' || v.command === 'stop' ? v.command : null
  return {
    requested: v.requested === true,
    requestedAt: typeof v.requested_at === 'string' ? v.requested_at : null,
    answer: typeof v.answer === 'string' && v.answer ? v.answer : null,
    command: cmd,
    commandId: typeof v.command_id === 'string' ? v.command_id : null,
  }
}

const ICE_WAIT_MS = 3000

function waitForIce(pc: RTCPeerConnection): Promise<void> {
  return new Promise((resolve) => {
    if (pc.iceGatheringState === 'complete') { resolve(); return }
    const done = () => {
      clearTimeout(timer)
      pc.removeEventListener('icegatheringstatechange', onChange)
      resolve()
    }
    const onChange = () => { if (pc.iceGatheringState === 'complete') done() }
    const timer = setTimeout(done, ICE_WAIT_MS)
    pc.addEventListener('icegatheringstatechange', onChange)
  })
}

export class PhoneLive {
  private pc: RTCPeerConnection | null = null
  private waitingAnswer = false
  private lastRequestedAt: string | null = null
  private lastCommandId: string | null = null
  private commandSeeded = false
  private timer: ReturnType<typeof setTimeout> | null = null
  private running = false
  private stopped = false
  private busy = false

  private deps: LiveDeps
  private intervalMs: number

  constructor(deps: LiveDeps, intervalMs = 1500) {
    this.deps = deps
    this.intervalMs = intervalMs
  }

  start(): void {
    if (this.running) return
    this.running = true
    this.schedule(0)
  }

  stop(): void {
    this.running = false
    this.stopped = true
    if (this.timer) clearTimeout(this.timer)
    this.timer = null
    this.closePc()
  }

  private schedule(ms: number): void {
    if (!this.running) return
    this.timer = setTimeout(() => { void this.tick().finally(() => this.schedule(this.intervalMs)) }, ms)
  }

  private closePc(): void {
    if (this.pc) {
      this.pc.onconnectionstatechange = null
      try { this.pc.close() } catch { /* already closed */ }
      this.pc = null
      this.deps.onViewing(false)
    }
    this.waitingAnswer = false
  }

  async tick(): Promise<void> {
    if (this.busy) return
    this.busy = true
    try {
      const out = await this.deps.poll()
      if (this.stopped) return
      if (!out.ok) {
        this.deps.onError(out.message, out.fatal)
        if (out.fatal) this.stop()
        return
      }
      const r = out.data

      // D. remote control — the first command_id seen after load is only remembered, never executed.
      if (!this.commandSeeded) {
        this.commandSeeded = true
        this.lastCommandId = r.commandId
      } else if (r.commandId && r.commandId !== this.lastCommandId) {
        this.lastCommandId = r.commandId
        if (r.command) this.deps.onCommand(r.command)
      }

      // E. iPad closed the live view.
      if (!r.requested) {
        this.lastRequestedAt = null
        this.closePc()
      } else if (r.requestedAt !== this.lastRequestedAt) {
        // B. new live request.
        this.lastRequestedAt = r.requestedAt
        await this.connect()
      } else if (this.waitingAnswer && this.pc && r.answer) {
        // C. answer for the current connection, applied once.
        this.waitingAnswer = false
        await this.pc.setRemoteDescription({ type: 'answer', sdp: r.answer })
      }
    } catch {
      this.deps.onError('直播連線發生錯誤', false)
    } finally {
      this.busy = false
    }
  }

  private async connect(): Promise<void> {
    this.closePc()
    const stream = this.deps.getStream()
    if (!stream) return
    const pc = this.deps.createPc()
    this.pc = pc
    pc.onconnectionstatechange = () => {
      if (this.pc !== pc) return
      this.deps.onViewing(pc.connectionState === 'connected')
    }
    stream.getVideoTracks().forEach((t) => pc.addTrack(t, stream))
    const offer = await pc.createOffer()
    await pc.setLocalDescription(offer)
    await waitForIce(pc)
    const sdp = pc.localDescription?.sdp
    if (!sdp) { this.deps.onError('直播連線失敗', false); return }
    this.waitingAnswer = await this.deps.sendOffer(sdp)
    if (!this.waitingAnswer) this.deps.onError('直播連線失敗', false)
  }
}

// ── Supabase RPC helpers (shared by the page and the tests; `fetchImpl` is injectable) ──
const RPC_BASE = 'https://wqmciwieiqvnswvspdyz.supabase.co/rest/v1/rpc/'
// Publishable key: public by design.
const PUBLISHABLE_KEY = 'sb_publishable_KAycCemv78UlO3k6W1VWBA_LA2WreFg'

type FetchLike = (input: string, init?: RequestInit) => Promise<Response>

async function rpc(name: string, body: Record<string, unknown>, fetchImpl: FetchLike): Promise<{ ok: boolean; status: number; json: unknown }> {
  const res = await fetchImpl(RPC_BASE + name, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: PUBLISHABLE_KEY,
      Authorization: `Bearer ${PUBLISHABLE_KEY}`,
    },
    body: JSON.stringify(body),
  })
  const json: unknown = await res.json().catch(() => null)
  return { ok: res.ok, status: res.status, json }
}

function errorOutcome(json: unknown): { ok: false; fatal: boolean; message: string } {
  const code = isRecord(json) && typeof json.message === 'string' ? json.message : ''
  if (code.includes('BAD_PIN')) return { ok: false, fatal: true, message: 'PIN 不正確' }
  if (code.includes('ROOM_NOT_FOUND')) return { ok: false, fatal: true, message: '找不到房間，請重新掃描 iPad 上的 QR' }
  return { ok: false, fatal: false, message: '連線失敗' }
}

export async function pollRpc(room: string, pin: string, fetchImpl: FetchLike = fetch): Promise<PollOutcome> {
  try {
    const r = await rpc('pilot_cam_phone_poll', { p_room: room, p_pin: pin }, fetchImpl)
    if (!r.ok) return errorOutcome(r.json)
    const data = parsePoll(r.json)
    return data ? { ok: true, data } : { ok: false, fatal: false, message: '連線失敗' }
  } catch {
    return { ok: false, fatal: false, message: '連線失敗' }
  }
}

export async function sendOfferRpc(room: string, pin: string, sdp: string, fetchImpl: FetchLike = fetch): Promise<boolean> {
  try {
    const r = await rpc('pilot_cam_phone_offer', { p_room: room, p_pin: pin, p_offer: sdp }, fetchImpl)
    return r.ok && isRecord(r.json) && r.json.ok === true
  } catch {
    return false
  }
}
