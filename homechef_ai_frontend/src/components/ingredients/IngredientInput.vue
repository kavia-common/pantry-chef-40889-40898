<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import api from '@/services/api'
import VoiceService from '@/services/voice'
import { useAppStore } from '@/stores/app'

/**
 * PUBLIC_INTERFACE
 * IngredientInput
 * A multi-input ingredient component with three tabs:
 *  - Text: manage chip-style ingredient tags, add/remove, and paste parsing ("egg, milk; butter")
 *  - Photo: upload an image, preview it, and call api.ingredients.parsePhoto to merge results as chips
 *  - Voice: start/stop voice capture; onResult appends parsed chips; respects feature flags for availability
 *
 * Props:
 *  - modelValue: string[] current ingredients
 *  - placeholder?: string text input placeholder for Text tab
 *  - label?: string accessible label for the input
 *  - disabled?: boolean disable all interactions
 *  - allowDuplicates?: boolean whether to allow duplicate chips (default false)
 *
 * Events:
 *  - update:modelValue (string[]) when ingredients change
 *
 * Accessibility:
 *  - Proper aria-labels, roles for tabs, and keyboard support for chip removal (Backspace/Delete)
 */
const props = withDefaults(defineProps<{
  modelValue: string[]
  placeholder?: string
  label?: string
  disabled?: boolean
  allowDuplicates?: boolean
}>(), {
  modelValue: () => [],
  placeholder: 'Add an ingredient and press Enter…',
  label: 'Ingredients',
  disabled: false,
  allowDuplicates: false,
})

const emit = defineEmits<{
  // PUBLIC_INTERFACE
  (e: 'update:modelValue', value: string[]): void
  (e: 'photo:parsing', value: boolean): void
  (e: 'voice:recording', value: boolean): void
}>()

// local state
const app = useAppStore()
const tabs = ['Text', 'Photo', 'Voice'] as const
type TabKey = typeof tabs[number]
const activeTab = ref<TabKey>('Text')

const textInput = ref<HTMLInputElement | null>(null)
const textValue = ref<string>('')

const chips = ref<string[]>([])
watch(() => props.modelValue, (nv) => {
  // keep internal chips in sync with external changes
  chips.value = [...(nv || [])]
}, { immediate: true })

const isUploading = ref(false)
const previewUrl = ref<string | null>(null)
const fileInput = ref<HTMLInputElement | null>(null)

const voiceSupported = computed(() => app.voiceEnabled)
const isRecording = ref<boolean>(false)

function normalizeToken(tok: string): string {
  // Trim and collapse whitespace
  return tok.replace(/\s+/g, ' ').trim()
}

function tokenize(input: string): string[] {
  // Split on commas, semicolons, newlines; drop empties; trim; de-duplicate later
  return input
    .split(/[,\n;]+/g)
    .map(normalizeToken)
    .filter(Boolean)
}

function addChip(value: string) {
  const v = normalizeToken(value)
  if (!v) return
  if (props.allowDuplicates !== true) {
    if (chips.value.some((c) => c.toLowerCase() === v.toLowerCase())) return
  }
  chips.value.push(v)
  emit('update:modelValue', [...chips.value])
}

function addChips(values: string[]) {
  for (const v of values) addChip(v)
}

function removeChipAt(idx: number) {
  if (idx < 0 || idx >= chips.value.length) return
  chips.value.splice(idx, 1)
  emit('update:modelValue', [...chips.value])
}

function onTextKeydown(e: KeyboardEvent) {
  if (props.disabled) return
  // Enter to add
  if (e.key === 'Enter') {
    e.preventDefault()
    if (textValue.value.trim()) {
      addChip(textValue.value)
      textValue.value = ''
    }
  }
  // Backspace on empty input removes last chip
  if (e.key === 'Backspace' && !textValue.value) {
    e.preventDefault()
    removeChipAt(chips.value.length - 1)
  }
}

function onTextPaste(e: ClipboardEvent) {
  if (props.disabled) return
  const text = e.clipboardData?.getData('text') ?? ''
  if (text && /[,;\n]/.test(text)) {
    e.preventDefault()
    const toks = tokenize(text)
    addChips(toks)
  }
}

function focusText() {
  textInput.value?.focus()
}

// Photo tab
async function onFileChange(e: Event) {
  if (props.disabled) return
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return
  if (previewUrl.value) URL.revokeObjectURL(previewUrl.value)
  previewUrl.value = URL.createObjectURL(file)
  await parsePhoto(file)
  // Clear selection to allow re-uploading the same file later
  input.value = ''
}

async function parsePhoto(file: File) {
  isUploading.value = true
  emit('photo:parsing', true)
  try {
    const res = await api.ingredients.parsePhoto(file)
    const items = Array.isArray(res?.items) ? res.items : []
    const names = items.map((it) => normalizeToken([it.name, it.quantity].filter(Boolean).join(' '))).filter(Boolean)
    if (names.length) {
      addChips(names)
      app.addToast(`Found ${names.length} item${names.length > 1 ? 's' : ''} from photo`, { type: 'success' })
    } else {
      app.addToast('No ingredients detected in photo', { type: 'warning' })
    }
  } catch {
    app.addToast('Failed to parse photo', { type: 'error' })
  } finally {
    isUploading.value = false
    emit('photo:parsing', false)
  }
}

function triggerFileSelect() {
  if (props.disabled) return
  fileInput.value?.click()
}

// Voice tab
let offResult: (() => void) | null = null
let offError: (() => void) | null = null

async function startVoice() {
  if (props.disabled) return
  const ok = await VoiceService.start()
  isRecording.value = ok && VoiceService.isRecording()
  emit('voice:recording', isRecording.value)
  if (!ok) {
    app.addToast('Voice input not available', { type: 'warning' })
    return
  }
}

async function stopVoice() {
  await VoiceService.stop()
  isRecording.value = false
  emit('voice:recording', false)
}

function onVoiceResult(text: string) {
  // Try to tokenize by commas/semicolons/newlines; if none present, treat entire text as one ingredient
  const tokens = tokenize(text)
  if (tokens.length > 0) {
    addChips(tokens)
  } else {
    const norm = normalizeToken(text)
    if (norm) addChip(norm)
  }
}

function onVoiceError() {
  // Don't spam toasts; just show a simple error
  app.addToast('Voice input error', { type: 'error' })
}

onMounted(() => {
  offResult = VoiceService.onResult(onVoiceResult)
  offError = VoiceService.onError(onVoiceError)
})

onBeforeUnmount(() => {
  try { offResult?.() } catch {}
  try { offError?.() } catch {}
  try { VoiceService.stop() } catch {}
})

// computed/hints
const photoHelp = computed(() => isUploading.value ? 'Analyzing photo…' : 'Upload a photo of ingredients or a receipt')

// keyboard for tabs
function setTab(tab: TabKey) {
  activeTab.value = tab
  if (tab === 'Text') {
    // focus text after render
    setTimeout(() => focusText(), 0)
  }
}

function onTabKeydown(e: KeyboardEvent, currentIndex: number) {
  if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
    e.preventDefault()
    const dir = e.key === 'ArrowRight' ? 1 : -1
    const next = (currentIndex + dir + tabs.length) % tabs.length
    setTab(tabs[next])
  }
}



// Expose a simple clear for parent if needed
// PUBLIC_INTERFACE
function clearAll() {
  chips.value = []
  emit('update:modelValue', [])
}

defineExpose({ clearAll })
</script>

<template>
  <div class="ingr u-card">
    <div class="ingr__header" :aria-label="label">
      <div class="tabs" role="tablist" aria-label="Ingredient input method">
        <button
          v-for="(t, i) in tabs"
          :key="t"
          class="tab"
          role="tab"
          :id="`ingr-tab-${t}`"
          :aria-selected="activeTab === t"
          :tabindex="activeTab === t ? 0 : -1"
          :aria-controls="`ingr-panel-${t}`"
          @click="setTab(t)"
          @keydown="onTabKeydown($event, i)"
        >{{ t }}</button>
      </div>
    </div>

    <div class="ingr__body">
      <!-- Text Tab -->
      <section
        v-show="activeTab === 'Text'"
        class="panel"
        role="tabpanel"
        :id="`ingr-panel-Text`"
        :aria-labelledby="`ingr-tab-Text`"
      >
        <div class="chips" @click="focusText">
          <span
            v-for="(c, idx) in chips"
            :key="`${c}-${idx}`"
            class="chip"
          >
            <span class="chip__label">{{ c }}</span>
            <button
              class="chip__x"
              type="button"
              :aria-label="`Remove ${c}`"
              @click.stop="removeChipAt(idx)"
            >
              ×
            </button>
          </span>

          <input
            ref="textInput"
            class="chip-input"
            type="text"
            :placeholder="chips.length ? '' : placeholder"
            :disabled="disabled"
            :aria-label="label"
            v-model="textValue"
            @keydown="onTextKeydown"
            @paste="onTextPaste"
          />
        </div>
        <p class="hint">Tip: paste a comma-separated list to add multiple at once.</p>
      </section>

      <!-- Photo Tab -->
      <section
        v-show="activeTab === 'Photo'"
        class="panel"
        role="tabpanel"
        :id="`ingr-panel-Photo`"
        :aria-labelledby="`ingr-tab-Photo`"
      >
        <div class="photo-uploader">
          <input
            ref="fileInput"
            type="file"
            accept="image/*"
            class="sr-only"
            :disabled="disabled || isUploading"
            @change="onFileChange"
          />
          <div class="photo-actions">
            <button
              class="u-btn u-btn--primary"
              type="button"
              :disabled="disabled || isUploading"
              @click="triggerFileSelect"
            >
              {{ isUploading ? 'Analyzing…' : 'Upload Photo' }}
            </button>
            <span class="photo-help" :aria-live="isUploading ? 'assertive' : 'polite'">
              {{ photoHelp }}
            </span>
          </div>

          <div v-if="previewUrl" class="photo-preview u-surface" role="img" aria-label="Selected image preview">
            <img :src="previewUrl" alt="Selected image preview" />
          </div>
        </div>
      </section>

      <!-- Voice Tab -->
      <section
        v-show="activeTab === 'Voice'"
        class="panel"
        role="tabpanel"
        :id="`ingr-panel-Voice`"
        :aria-labelledby="`ingr-tab-Voice`"
      >
        <div class="voice-panel">
          <div class="voice-controls">
            <template v-if="voiceSupported">
              <button
                v-if="!isRecording"
                class="u-btn u-btn--primary"
                type="button"
                :disabled="disabled"
                @click="startVoice"
                aria-pressed="false"
              >
                Start Listening
              </button>
              <button
                v-else
                class="u-btn u-btn--secondary"
                type="button"
                @click="stopVoice"
                aria-pressed="true"
              >
                Stop
              </button>
              <span class="voice-status" :class="{ 'is-recording': isRecording }" aria-live="polite">
                {{ isRecording ? 'Listening… say your ingredients.' : 'Press to start voice input.' }}
              </span>
            </template>
            <template v-else>
              <div class="voice-unsupported">
                <strong>Voice input unavailable.</strong>
                <span style="display:block;color:#6b7280;">Enable the "voice" feature flag or use a supported browser.</span>
              </div>
            </template>
          </div>
          <p class="hint">Say ingredients separated by pauses or "and". Example: "tomatoes, basil, olive oil".</p>
        </div>
      </section>
    </div>
  </div>
</template>

<style scoped>
/* Layout */
.ingr {
  display: grid;
  gap: 0.5rem;
}

/* Tabs */
.tabs {
  display: inline-flex;
  gap: 0.25rem;
  border: 1px solid var(--hc-border);
  border-radius: var(--hc-radius-sm);
  background: var(--hc-surface);
  padding: 0.125rem;
}
.tab {
  appearance: none;
  background: transparent;
  border: 0;
  padding: 0.4rem 0.7rem;
  border-radius: calc(var(--hc-radius-sm) - 2px);
  cursor: pointer;
  color: #374151;
  font-weight: 600;
}
.tab[aria-selected="true"] {
  background: #e0e7ff; /* indigo-100 */
  color: var(--hc-primary);
}
.tab:focus-visible {
  outline: none;
  box-shadow: 0 0 0 3px var(--hc-ring);
}

/* Panels */
.panel {
  margin-top: 0.25rem;
}

/* Chips input */
.chips {
  min-height: 42px;
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 0.35rem;
  border: 1px solid var(--hc-border);
  border-radius: var(--hc-radius);
  padding: 0.35rem 0.5rem;
  background: #fff;
}
.chips:focus-within {
  box-shadow: 0 0 0 3px var(--hc-ring);
}
.chip {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  background: #eef2ff;
  color: #1e3a8a;
  border: 1px solid #c7d2fe;
  border-radius: 999px;
  padding: 0.15rem 0.45rem 0.15rem 0.6rem;
}
.chip__x {
  background: transparent;
  border: 0;
  color: #1e40af;
  width: 1.25rem;
  height: 1.25rem;
  border-radius: 999px;
  cursor: pointer;
  line-height: 1;
}
.chip__x:hover {
  background: rgba(30, 64, 175, 0.08);
}
.chip-input {
  flex: 1 1 180px;
  min-width: 160px;
  border: 0;
  outline: none;
  padding: 0.35rem;
  font-size: 0.95rem;
}

/* Photo */
.photo-uploader { display: grid; gap: 0.5rem; }
.photo-actions { display: flex; align-items: center; gap: 0.5rem; }
.photo-help { color: #6b7280; }
.photo-preview {
  display: inline-block;
  border-radius: var(--hc-radius);
  padding: 0.25rem;
  border: 1px solid var(--hc-border);
  max-width: 360px;
}
.photo-preview img {
  display: block;
  width: 100%;
  height: auto;
  border-radius: var(--hc-radius-sm);
}

/* Voice */
.voice-controls { display: flex; align-items: center; gap: 0.5rem; }
.voice-status { color: #374151; }
.voice-status.is-recording { color: #065f46; } /* emerald-ish */
.voice-unsupported { padding: 0.5rem; border: 1px dashed var(--hc-border); border-radius: var(--hc-radius-sm); background: #f9fafb; }

/* Utility */
.hint {
  margin-top: 0.35rem;
  color: #6b7280;
  font-size: 0.875rem;
}

.sr-only {
  position: absolute !important;
  height: 1px; width: 1px;
  overflow: hidden; clip: rect(1px, 1px, 1px, 1px);
  white-space: nowrap; border: 0; padding: 0; margin: -1px;
}
</style>
