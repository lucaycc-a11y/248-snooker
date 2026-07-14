export function useHaptic() {
  return {
    vibrate: (ms = 8) => {
      if (typeof navigator !== 'undefined' && navigator.vibrate) {
        navigator.vibrate(ms)
      }
    },
  }
}
