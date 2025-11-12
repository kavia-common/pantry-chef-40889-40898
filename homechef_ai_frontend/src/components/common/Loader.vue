<script setup lang="ts">
defineOptions({ name: 'HcLoader' })
/**
 * PUBLIC_INTERFACE
 * Loader component: Shows a spinner with optional label.
 * - Props:
 *    - size: 'sm' | 'md' | 'lg'
 *    - label?: string (for screen readers/visual label)
 *    - inline?: boolean (if true, do not create a block container)
 * - Emits: none
 * Accessibility:
 * - role="status" and aria-live="polite" for announcing loading state.
 */
const props = withDefaults(defineProps<{
  size?: 'sm' | 'md' | 'lg'
  label?: string
  inline?: boolean
}>(), {
  size: 'md',
  label: 'Loading',
  inline: false,
})

const sizePx: Record<'sm'|'md'|'lg', number> = { sm: 16, md: 22, lg: 32 }
</script>

<template>
  <div
    class="loader"
    :class="{ inline: props.inline }"
    role="status"
    aria-live="polite"
    :aria-label="props.label"
  >
    <svg
      class="spinner"
      :width="sizePx[props.size]"
      :height="sizePx[props.size]"
      viewBox="0 0 50 50"
      aria-hidden="true"
    >
      <circle class="path" cx="25" cy="25" r="20" fill="none" stroke-width="6" />
    </svg>
    <span class="loader-label" v-if="props.label">{{ props.label }}</span>
  </div>
</template>

<style scoped>
.loader {
  display: inline-flex;
  align-items: center;
  gap: .5rem;
  color: var(--hc-primary);
}
.loader.inline {
  display: inline-flex;
}

.spinner {
  animation: rotate 1s linear infinite;
}

.path {
  stroke: var(--hc-primary);
  stroke-linecap: round;
  animation: dash 1.5s ease-in-out infinite;
}

.loader-label {
  font-size: .9rem;
  color: #374151;
}

@keyframes rotate {
  100% { transform: rotate(360deg); }
}
@keyframes dash {
  0% { stroke-dasharray: 1, 150; stroke-dashoffset: 0; }
  50% { stroke-dasharray: 90, 150; stroke-dashoffset: -35; }
  100% { stroke-dasharray: 90, 150; stroke-dashoffset: -124; }
}
</style>
