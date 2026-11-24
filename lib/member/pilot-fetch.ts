// Shared fetch layer for the member Space Pilot page.
// - De-duplicates concurrent requests (prefetch + component mount share one network call).
// - Keeps the last JSON in sessionStorage so a revisit paints instantly, then revalidates.

const KEY = "pilot:";
const FRESH_MS = 15_000;

export const PILOT_URLS = [
  "/api/member/pilot",
  "/api/member/pilot/insights",
  "/api/member/pilot/rotations",
  "/api/member/pilot/clips",
] as const;

const inflight = new Map<string, { at: number; promise: Promise<unknown> }>();

export function pilotFetch(url: string, force = false): Promise<unknown> {
  const hit = inflight.get(url);
  if (!force && hit && Date.now() - hit.at < FRESH_MS) return hit.promise;
  const promise = fetch(url, { cache: "no-store" })
    .then(async (res) => {
      const json: unknown = await res.json().catch(() => null);
      if (!res.ok) throw new Error(String(res.status));
      try {
        sessionStorage.setItem(KEY + url, JSON.stringify(json));
      } catch {
        /* storage full or unavailable */
      }
      return json;
    })
    .catch((err: unknown) => {
      inflight.delete(url);
      throw err;
    });
  inflight.set(url, { at: Date.now(), promise });
  return promise;
}

/** Last successful response for `url` from this browser session, or null. */
export function pilotCached(url: string): unknown {
  try {
    const raw = sessionStorage.getItem(KEY + url);
    return raw ? (JSON.parse(raw) as unknown) : null;
  } catch {
    return null;
  }
}

/** Fire all Space Pilot requests at once so sections do not wait on each other. */
export function prefetchPilot(): void {
  for (const url of PILOT_URLS) pilotFetch(url).catch(() => undefined);
}
