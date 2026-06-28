export const userStates = new Map()
const processingLock = new Map()

export function markAwaitingOTP(phone) {
  userStates.set(phone, {
    awaitingOTP: true,
    updatedAt: Date.now(),
  })
}

export function clearUserState(phone) {
  userStates.delete(phone)
}

export function acquireProcessingLock(phone, ttlMs = 3000) {
  if (processingLock.has(phone)) return false

  processingLock.set(phone, true)
  setTimeout(() => processingLock.delete(phone), ttlMs)
  return true
}
