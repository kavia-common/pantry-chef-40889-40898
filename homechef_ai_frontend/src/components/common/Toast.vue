<script setup lang="ts">
import { computed } from 'vue'
import { useAppStore, type Toast as ToastItem } from '@/stores/app'

// Ensure multi-word component name for eslint rule
defineOptions({ name: 'HcToast' })

/**
 * PUBLIC_INTERFACE
 * Toast component: Renders a stack of toasts from the global app store queue.
 * - Props:
 *    - position: controls placement (top-right | top-left | bottom-right | bottom-left)
 * - Emits:
 *    - 'dismiss' (id: string): fired when a toast is dismissed manually
 * Accessibility:
 * - role="status" for info/success; role="alert" for error/warning for screen reader announcement.
 * - aria-live="polite" (info/success) and aria-live="assertive" (error/warning).
 */
const props = withDefaults(defineProps<{
  position?: 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left'
}>(), {
  position: 'top-right',
})
// touch prop to satisfy no-unused-vars; also useful if logic needed in script
const position = props.position

const emit = defineEmits<{
  (e: 'dismiss', id: string): void
}>()

const app = useAppStore()
const toasts = computed(() => app.toasts)

function onDismiss(id: string) {
  app.removeToast(id)
  emit('dismiss', id)
}

function getRole(t: ToastItem) {
  return t.type === 'error' || t.type === 'warning' ? 'alert' : 'status'
}

function getAriaLive(t: ToastItem) {
  return t.type === 'error' || t.type === 'warning' ? 'assertive' : 'polite'
}

function iconFor(t: ToastItem) {
  switch (t.type) {
    case 'success':
      return 'M5 13l4 4L19 7' // check
    case 'error':
      return 'M6 18L18 6M6 6l12 12' // x
    case 'warning':
      return 'M12 9v4m0 4h.01' // exclamation
    default:
      return 'M13 16h-1v-4h-1m1-4h.01' // info
  }
}

function typeClass(t: ToastItem) {
  switch (t.type) {
    case 'success': return 'toast--success'
    case 'error': return 'toast--error'
    case 'warning': return 'toast--warning'
    default: return 'toast--info'
  }
}
</script>

<template>
  <div
    class="toast-container"
    :class="[
      position.includes('top') ? 'is-top' : 'is-bottom',
      position.includes('right') ? 'is-right' : 'is-left',
    ]"
    aria-live="polite"
  >
    <div
      v-for="t in toasts"
      :key="t.id"
      class="toast u-card"
      :class="typeClass(t)"
      :role="getRole(t)"
      :aria-live="getAriaLive(t)"
      aria-atomic="true"
    >
      <div class="toast-icon" aria-hidden="true">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
          <path :d="iconFor(t)" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
        </svg>
      </div>
      <div class="toast-message">
        {{ t.message }}
      </div>
      <button
        class="u-btn u-btn--ghost toast-close"
        :aria-label="`Dismiss ${t.type ?? 'info'} notification`"
        @click="onDismiss(t.id)"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M6 18L18 6M6 6l12 12" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
        </svg>
      </button>
    </div>
  </div>
</template>

<style scoped>
.toast-container {
  position: fixed;
  z-index: 60;
  display: flex;
  flex-direction: column;
  gap: .5rem;
  max-width: 92vw;
}
.toast-container.is-top { top: 1rem; }
.toast-container.is-bottom { bottom: 1rem; }
.toast-container.is-right { right: 1rem; align-items: flex-end; }
.toast-container.is-left { left: 1rem; align-items: flex-start; }

.toast {
  display: grid;
  grid-template-columns: 20px 1fr auto;
  align-items: start;
  gap: .5rem;
  padding: .6rem .6rem .6rem .6rem;
  min-width: 260px;
  max-width: 420px;
}

.toast-icon {
  width: 20px;
  height: 20px;
  margin-top: 2px;
}

.toast-message {
  font-size: .95rem;
  line-height: 1.25rem;
}

.toast-close {
  border: none;
  padding: .25rem;
  color: #6b7280;
}

.toast--info {
  border-left: 4px solid var(--hc-primary);
}
.toast--success {
  border-left: 4px solid var(--hc-success);
}
.toast--error {
  border-left: 4px solid var(--hc-error);
}
.toast--warning {
  border-left: 4px solid var(--hc-secondary);
}
</style>
