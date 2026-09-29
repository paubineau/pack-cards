/* Adapted from cardpack-webgl, Copyright (c) 2026 2manslkh, MIT. See LICENSE and README.md. */
/**
 * Device-capability tier for the GPU-heavy reveal effects (the pack tear +
 * reveal shader background).
 *
 * Save-data, low-memory, and hard low-core signals select the reduced path.
 * Unknown-capability devices retain full fidelity rather than being guessed low.
 */

export type DeviceTier = 'low' | 'normal'

export type DeviceSignals = {
  /** navigator.deviceMemory in GB (rounded; Chromium/Android only — absent on iOS). */
  deviceMemory?: number
  /** navigator.hardwareConcurrency (logical cores). */
  hardwareConcurrency?: number
  /** navigator.connection.saveData — the user opted into reduced data/effects. */
  saveData?: boolean
}

const LOW_MEMORY_GB = 4
const LOW_CORE_COUNT = 2

export function classifyDeviceTier(s: DeviceSignals): DeviceTier {
  if (s.saveData) return 'low'
  if (typeof s.deviceMemory === 'number' && s.deviceMemory <= LOW_MEMORY_GB) return 'low'
  if (typeof s.hardwareConcurrency === 'number' && s.hardwareConcurrency <= LOW_CORE_COUNT) return 'low'
  return 'normal'
}

const cache = new WeakMap<Navigator, DeviceTier>()

/**
 * Device tier derived once from stable browser capability hints.
 */
export function getDeviceTier(navigator: Navigator): DeviceTier {
  const cached = cache.get(navigator)
  if (cached) return cached
  const nav = navigator as Navigator & {
    deviceMemory?: number
    connection?: { saveData?: boolean }
  }
  const tier = classifyDeviceTier({
    deviceMemory: nav.deviceMemory,
    hardwareConcurrency: nav.hardwareConcurrency,
    saveData: nav.connection?.saveData,
  })
  cache.set(navigator, tier)
  return tier
}

/** Cap on the canvas device-pixel-ratio. Low tier renders a smaller framebuffer. */
export function maxDprForTier(tier: DeviceTier): number {
  return tier === 'low' ? 1.5 : 2
}

/** Whether to draw the expensive additive god-ray glow pass (skipped on low tier). */
export function glowEnabledForTier(tier: DeviceTier): boolean {
  return tier !== 'low'
}

/** Redraw rate while the pack just sits idle (only the hint pulse animates). */
export function idleFpsForTier(tier: DeviceTier): number {
  return tier === 'low' ? 20 : 30
}
