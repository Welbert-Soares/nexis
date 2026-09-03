function vibrate(pattern: number | number[]) {
  if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
    navigator.vibrate(pattern)
  }
}

export function useHaptic() {
  return {
    tap: () => vibrate(8),
    success: () => vibrate([10, 40, 10]),
    error: () => vibrate([30, 20, 30]),
    heavy: () => vibrate(25),
  }
}
