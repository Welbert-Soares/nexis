const canVibrate = typeof navigator !== 'undefined' && 'vibrate' in navigator

export function useHaptic() {
  return {
    tap: () => canVibrate && navigator.vibrate(8),
    success: () => canVibrate && navigator.vibrate([10, 40, 10]),
    error: () => canVibrate && navigator.vibrate([30, 20, 30]),
    heavy: () => canVibrate && navigator.vibrate(25),
  }
}
