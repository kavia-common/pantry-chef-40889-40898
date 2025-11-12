<script setup lang="ts">
import { computed, reactive, watch } from 'vue'
import { useAppStore, parseFeatureFlags, getEnvFlags } from '@/stores/app'

/**
 * SettingsView
 * - Displays read-only environment information for diagnostics.
 * - Provides toggles for feature flags bound to the app store with persistence (localStorage).
 * - Accessible controls with theme styling.
 */

// App store for feature flags and toasts
const app = useAppStore()

// Build readonly environment info safely
type ImportMetaEnvSafe = {
  VITE_API_BASE?: string
  VITE_BACKEND_URL?: string
  VITE_FRONTEND_URL?: string
  VITE_WS_URL?: string
  VITE_NODE_ENV?: string
  VITE_NEXT_TELEMETRY_DISABLED?: string
  VITE_ENABLE_SOURCE_MAPS?: string
  VITE_PORT?: string
  VITE_TRUST_PROXY?: string
  VITE_LOG_LEVEL?: string
  VITE_HEALTHCHECK_PATH?: string
  VITE_FEATURE_FLAGS?: string
  VITE_EXPERIMENTS_ENABLED?: string
}
type ImportMetaSafe = { env?: ImportMetaEnvSafe }

const env = (import.meta as unknown as ImportMetaSafe)?.env || {}
const envInfo = computed(() => {
  return [
    { key: 'VITE_API_BASE', value: env.VITE_API_BASE || '' },
    { key: 'VITE_BACKEND_URL', value: env.VITE_BACKEND_URL || '' },
    { key: 'VITE_FRONTEND_URL', value: env.VITE_FRONTEND_URL || '' },
    { key: 'VITE_WS_URL', value: env.VITE_WS_URL || '' },
    { key: 'VITE_NODE_ENV', value: env.VITE_NODE_ENV || '' },
    { key: 'VITE_NEXT_TELEMETRY_DISABLED', value: env.VITE_NEXT_TELEMETRY_DISABLED || '' },
    { key: 'VITE_ENABLE_SOURCE_MAPS', value: env.VITE_ENABLE_SOURCE_MAPS || '' },
    { key: 'VITE_PORT', value: env.VITE_PORT || '' },
    { key: 'VITE_TRUST_PROXY', value: env.VITE_TRUST_PROXY || '' },
    { key: 'VITE_LOG_LEVEL', value: env.VITE_LOG_LEVEL || '' },
    { key: 'VITE_HEALTHCHECK_PATH', value: env.VITE_HEALTHCHECK_PATH || '' },
    { key: 'VITE_FEATURE_FLAGS', value: env.VITE_FEATURE_FLAGS || '' },
    { key: 'VITE_EXPERIMENTS_ENABLED', value: env.VITE_EXPERIMENTS_ENABLED || '' },
  ]
})

// Feature Flags toggles
// Persist user overrides to localStorage: key "hc_flags_overrides" as CSV "flag1,flag2"
const STORAGE_KEY = 'hc_flags_overrides'

// Start with env flags then merge overrides
function loadOverrides(): Set<string> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY) || ''
    return parseFeatureFlags(raw)
  } catch {
    return new Set()
  }
}

function saveOverrides(set: Set<string>) {
  try {
    const csv = Array.from(set).join(',')
    localStorage.setItem(STORAGE_KEY, csv)
  } catch {
    // ignore storage errors
  }
}

const base = getEnvFlags().flags
const overrides = reactive<Set<string>>(loadOverrides())

// Expose known feature toggles for UX. Unknown flags remain respected but not rendered.
const knownFlags = [
  { key: 'voice', label: 'Voice input', desc: 'Enable voice input (Web Speech API or server transcription fallback).' },
  { key: 'streaming', label: 'Streaming/Live updates', desc: 'Enable live streaming via WebSocket for progressive updates.' },
  { key: 'voice_server', label: 'Server transcription', desc: 'Allow MediaRecorder + server transcription fallback when Speech API is unavailable.' },
  { key: 'voice_off', label: 'Disable voice explicitly', desc: 'Force disable voice features regardless of experiments.' },
  { key: 'stt_off', label: 'Disable Speech-to-Text', desc: 'Disable Web Speech API usage even if voice is enabled.' },
]

// Effective flags = env base union overrides
const effectiveFlags = computed<Set<string>>(() => {
  const merged = new Set<string>()
  for (const f of base) merged.add(f)
  for (const f of overrides) merged.add(f)
  return merged
})

function isFlagEnabled(k: string): boolean {
  return effectiveFlags.value.has(k)
}

function toggleFlag(k: string) {
  const has = overrides.has(k)
  if (has) {
    overrides.delete(k)
  } else {
    overrides.add(k)
  }
  saveOverrides(overrides)
  // Apply to app store by refreshing from env, then union overrides locally to store
  app.refreshFlagsFromEnv()
  const next = new Set<string>(app.featureFlags)
  for (const f of overrides) next.add(f)
  // assign to the ref's value to avoid any casts
  ;(app.featureFlags as unknown as { value: Set<string> }).value = next
  app.addToast(`Flag "${k}" ${has ? 'disabled' : 'enabled'}`, { type: 'success', timeoutMs: 2000 })
}

// Keep store in sync if overrides change externally (rare)
watch(
  () => Array.from(overrides.values()).sort().join(','),
  () => {
    const next = new Set<string>(getEnvFlags().flags)
    for (const f of overrides) next.add(f)
    ;(app.featureFlags as unknown as { value: Set<string> }).value = next
  },
  { immediate: true }
)

const experimentsEnabled = computed({
  get: () => app.experimentsEnabled,
  set: (v: boolean) => {
    try {
      localStorage.setItem('hc_experiments', v ? '1' : '0')
    } catch {}
    // assign to ref value without any
    ;(app.experimentsEnabled as unknown as { value: boolean }).value = v
    app.addToast(`Experiments ${v ? 'enabled' : 'disabled'}`, { type: 'info', timeoutMs: 1500 })
  },
})

// Attempt to restore experiments override
try {
  const raw = localStorage.getItem('hc_experiments')
  if (raw === '1' || raw === 'true') {
    ;(app.experimentsEnabled as unknown as { value: boolean }).value = true
  } else if (raw === '0' || raw === 'false') {
    ;(app.experimentsEnabled as unknown as { value: boolean }).value = false
  }
} catch {
  // ignore
}
</script>

<template>
  <section class="container settings" style="padding-top:.5rem; padding-bottom:.5rem;">
    <div class="u-card">
      <header class="s-head">
        <h1 class="s-title">Settings</h1>
        <p class="s-desc">Manage feature flags and view environment information.</p>
      </header>

      <div class="s-grid">
        <!-- Feature Flags -->
        <section class="s-panel">
          <h2 class="s-h2">Feature Flags</h2>

          <div class="row exp">
            <label class="switch">
              <input
                type="checkbox"
                role="switch"
                :aria-checked="experimentsEnabled"
                :checked="experimentsEnabled"
                @change="experimentsEnabled = !experimentsEnabled"
              />
              <span class="switch__slider" aria-hidden="true"></span>
              <span class="switch__label">
                Experiments
                <span class="muted">Allow experimental features when not explicitly disabled</span>
              </span>
            </label>
          </div>

          <div class="flags">
            <div
              v-for="f in knownFlags"
              :key="f.key"
              class="row"
            >
              <label class="switch">
                <input
                  type="checkbox"
                  role="switch"
                  :id="`flag-${f.key}`"
                  :checked="isFlagEnabled(f.key)"
                  :aria-checked="isFlagEnabled(f.key)"
                  @change="toggleFlag(f.key)"
                />
                <span class="switch__slider" aria-hidden="true"></span>
                <span class="switch__label">
                  <strong>{{ f.label }}</strong>
                  <span class="muted">{{ f.desc }}</span>
                </span>
              </label>
            </div>
          </div>

          <p class="hint">
            Flags reflect env plus your local overrides. Overrides persist in your browser (localStorage).
          </p>
        </section>

        <!-- Environment Information -->
        <section class="s-panel">
          <h2 class="s-h2">Environment</h2>
          <div class="env-list" role="list">
            <div v-for="item in envInfo" :key="item.key" class="env-row" role="listitem">
              <div class="env-key">{{ item.key }}</div>
              <div class="env-val">
                <code>{{ item.value || '—' }}</code>
              </div>
            </div>
          </div>
          <p class="hint">These values are read-only and useful for diagnostics.</p>
        </section>
      </div>
    </div>
  </section>
</template>

<style scoped>
.settings { display: grid; gap: .75rem; }
.s-head { display: grid; gap: .25rem; }
.s-title { font-size: 1.4rem; font-weight: 800; }
.s-desc { color: #4b5563; }

.s-grid {
  display: grid;
  gap: .75rem;
  grid-template-columns: 1fr;
  margin-top: .5rem;
}
@media (min-width: 1024px) {
  .s-grid { grid-template-columns: 1fr 1fr; }
}

.s-panel {
  background: var(--hc-surface);
  border: 1px solid var(--hc-border);
  border-radius: var(--hc-radius);
  padding: .75rem;
  box-shadow: var(--hc-shadow);
  display: grid;
  gap: .5rem;
}
.s-h2 { font-weight: 800; font-size: 1.05rem; }

.flags { display: grid; gap: .35rem; }
.row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: .5rem;
  padding: .35rem .4rem;
  border: 1px solid var(--hc-border);
  border-radius: var(--hc-radius-sm);
  background: #f9fafb;
}
.exp {
  background: #fff7ed; /* amber-50 */
  border-color: #fde68a; /* amber-200 */
}
.switch {
  display: grid;
  grid-template-columns: auto 1fr;
  gap: .5rem;
  align-items: center;
  width: 100%;
}
.switch input[type="checkbox"] {
  appearance: none;
  width: 38px;
  height: 22px;
  border-radius: 999px;
  border: 1px solid var(--hc-border);
  background: #e5e7eb;
  position: relative;
  cursor: pointer;
  outline: none;
}
.switch input[type="checkbox"]:focus-visible {
  box-shadow: 0 0 0 3px var(--hc-ring);
}
.switch input[type="checkbox"]:checked {
  background: var(--hc-primary);
  border-color: #1d4ed8;
}
.switch__slider {
  position: relative;
  width: 0; height: 0; /* purely decorative using ::after knob */
}
.switch input[type="checkbox"]::after {
  content: "";
  position: absolute;
  top: 2px; left: 2px;
  width: 18px; height: 18px;
  background: #fff;
  border-radius: 999px;
  box-shadow: 0 1px 2px rgba(0,0,0,.2);
  transition: transform .2s ease;
}
.switch input[type="checkbox"]:checked::after {
  transform: translateX(16px);
}

.switch__label {
  display: grid;
  gap: .15rem;
}
.switch__label .muted { color: #6b7280; font-size: .9rem; }

.env-list { display: grid; gap: .25rem; }
.env-row {
  display: grid;
  grid-template-columns: 1fr;
  gap: .25rem;
  padding: .35rem .4rem;
  border: 1px solid var(--hc-border);
  border-radius: var(--hc-radius-sm);
  background: #f9fafb;
}
@media (min-width: 640px) {
  .env-row { grid-template-columns: 240px 1fr; align-items: center; }
}
.env-key { font-weight: 700; color: #111827; }
.env-val code {
  display: inline-block;
  background: #0b1220;
  color: #e5e7eb;
  padding: .15rem .3rem;
  border-radius: 6px;
  overflow-x: auto;
  max-width: 100%;
}
.hint { color: #6b7280; font-size: .9rem; }
</style>
