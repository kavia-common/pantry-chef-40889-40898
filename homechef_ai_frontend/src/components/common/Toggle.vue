<script setup lang="ts">
import { computed } from 'vue'
defineOptions({ name: 'HcToggle' })

/**
 * PUBLIC_INTERFACE
 * Toggle (Switch) component: Accessible toggle with v-model support.
 * - Props:
 *    - modelValue: boolean
 *    - label?: string (for aria-label/aria-labelledby)
 *    - disabled?: boolean
 * - Emits:
 *    - 'update:modelValue' (boolean)
 *    - 'change' (boolean)
 */
const props = withDefaults(defineProps<{
  modelValue: boolean
  label?: string
  disabled?: boolean
}>(), {
  modelValue: false,
  label: '',
  disabled: false,
})

const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void
  (e: 'change', value: boolean): void
}>()

const isOn = computed(() => !!props.modelValue)

function toggle() {
  if (props.disabled) return
  const next = !isOn.value
  emit('update:modelValue', next)
  emit('change', next)
}

function onKey(e: KeyboardEvent) {
  if (e.key === ' ' || e.key === 'Enter') {
    e.preventDefault()
    toggle()
  }
}
</script>

<template>
  <button
    type="button"
    class="toggle"
    :class="{ 'is-on': isOn, disabled: props.disabled }"
    role="switch"
    :aria-checked="isOn"
    :aria-label="props.label || 'Toggle'"
    :disabled="props.disabled"
    @click="toggle"
    @keydown="onKey"
  >
    <span class="knob" aria-hidden="true"></span>
  </button>
</template>

<style scoped>
.toggle {
  width: 44px;
  height: 24px;
  border-radius: 999px;
  background: #e5e7eb;
  border: 1px solid #e5e7eb;
  position: relative;
  transition: background-color .2s ease, border-color .2s ease;
}
.toggle:is(:hover,:focus-visible) {
  border-color: var(--hc-primary);
  box-shadow: 0 0 0 3px var(--hc-ring);
  outline: none;
}
.toggle.is-on {
  background: var(--hc-primary);
  border-color: var(--hc-primary);
}

.toggle.disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.knob {
  position: absolute;
  top: 2px;
  left: 2px;
  width: 20px;
  height: 20px;
  background: var(--hc-surface);
  border-radius: 999px;
  transition: transform .2s ease;
  box-shadow: var(--hc-shadow);
}
.toggle.is-on .knob {
  transform: translateX(20px);
}
</style>
