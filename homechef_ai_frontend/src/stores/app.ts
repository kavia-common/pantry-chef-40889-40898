import { ref, computed, reactive, onMounted, onUnmounted } from 'vue'
import { defineStore } from 'pinia'

type ImportMetaEnvSafe = {
  VITE_FEATURE_FLAGS?: string
  VITE_EXPERIMENTS_ENABLED?: string
}
type ImportMetaSafe = {
  env?: ImportMetaEnvSafe
}

export type FeatureFlags = Set<string>

export interface Toast {
  id: string
  message: string
  type?: 'info' | 'success' | 'error' | 'warning'
  timeoutMs?: number
}

// PUBLIC_INTERFACE
export function parseFeatureFlags(raw?: string): FeatureFlags {
  const set: FeatureFlags = new Set()
  if (!raw) return set
  for (const token of raw.split(',').map((s) => s.trim()).filter(Boolean)) {
    set.add(token)
  }
  return set
}

// PUBLIC_INTERFACE
export function getEnvFlags() {
  const meta = (import.meta as unknown as ImportMetaSafe) || {}
  const env = meta.env || {}
  const flags = parseFeatureFlags(env.VITE_FEATURE_FLAGS)
  const experimentsEnabledRaw = String(env.VITE_EXPERIMENTS_ENABLED ?? '').toLowerCase()
  const experimentsEnabled =
    experimentsEnabledRaw === '1' || experimentsEnabledRaw === 'true' || experimentsEnabledRaw === 'yes'
  return { flags, experimentsEnabled }
}

/**
 * PUBLIC_INTERFACE
 * useAppStore
 * - Holds app-level state like feature flags, online status, and toast notifications.
 * - Feature flags are sourced from env at app start; components may query booleans for voice/ws enablement.
 */
export const useAppStore = defineStore('app', () => {
  // Feature flags
  const initial = getEnvFlags()
  const featureFlags = ref<FeatureFlags>(initial.flags)
  const experimentsEnabled = ref<boolean>(initial.experimentsEnabled)

  // Online/offline tracking
  const isOnline = ref(typeof navigator !== 'undefined' ? navigator.onLine : true)
  function _setOnline(val: boolean) {
    isOnline.value = val
  }

  // Toast queue
  const toasts = reactive<Toast[]>([])

  // Derived gates for convenience across app
  const voiceEnabled = computed(() => {
    // enabled when "voice" flag present or experiments are on and not explicitly disabled
    return featureFlags.value.has('voice') || (experimentsEnabled.value && !featureFlags.value.has('voice_off'))
  })
  const wsEnabled = computed(() => {
    // streaming/websocket gated by "streaming" flag if any flags present; when no flags configured, default allow
    return featureFlags.value.size === 0 || featureFlags.value.has('streaming')
  })

  // PUBLIC_INTERFACE
  function addToast(message: string, opts?: { type?: Toast['type']; timeoutMs?: number; id?: string }) {
    const id = opts?.id || `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
    const toast: Toast = {
      id,
      message,
      type: opts?.type || 'info',
      timeoutMs: typeof opts?.timeoutMs === 'number' ? opts!.timeoutMs : 4000,
    }
    toasts.push(toast)
    // auto-remove
    if (toast.timeoutMs && toast.timeoutMs > 0) {
      setTimeout(() => removeToast(id), toast.timeoutMs)
    }
    return id
  }

  // PUBLIC_INTERFACE
  function removeToast(id: string) {
    const idx = toasts.findIndex((t) => t.id === id)
    if (idx >= 0) toasts.splice(idx, 1)
  }

  // PUBLIC_INTERFACE
  function clearToasts() {
    toasts.splice(0, toasts.length)
  }

  // PUBLIC_INTERFACE
  function hasFlag(flag: string): boolean {
    return featureFlags.value.has(flag)
  }

  // PUBLIC_INTERFACE
  function refreshFlagsFromEnv() {
    const { flags, experimentsEnabled: exp } = getEnvFlags()
    featureFlags.value = flags
    experimentsEnabled.value = exp
  }

  // Setup online listeners for components that mount this store
  let _mounted = false
  function setupOnlineListeners() {
    if (_mounted || typeof window === 'undefined') return
    const onUp = () => _setOnline(true)
    const onDown = () => _setOnline(false)
    window.addEventListener('online', onUp)
    window.addEventListener('offline', onDown)
    _mounted = true
    // expose for cleanup
    return () => {
      window.removeEventListener('online', onUp)
      window.removeEventListener('offline', onDown)
      _mounted = false
    }
  }

  // Optional: register lifecycle handlers to keep listeners accurate if store used in setup
  let cleanup: (() => void) | undefined
  onMounted(() => {
    cleanup = setupOnlineListeners()
  })
  onUnmounted(() => {
    try { cleanup?.() } catch { /* ignore */ }
  })

  return {
    // state
    featureFlags,
    experimentsEnabled,
    isOnline,
    toasts,

    // derived
    voiceEnabled,
    wsEnabled,

    // actions
    addToast,
    removeToast,
    clearToasts,
    hasFlag,
    refreshFlagsFromEnv,

    // internal util if needed by views
    setupOnlineListeners,
  }
})

export type AppStore = ReturnType<typeof useAppStore>
