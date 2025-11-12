<script setup lang="ts">
defineOptions({ name: 'HcEmptyState' })
/**
 * PUBLIC_INTERFACE
 * EmptyState: Display a friendly message and optional action when no data is present.
 * - Props:
 *    - title: string
 *    - description?: string
 * - Slots:
 *    - icon (optional)
 *    - actions (optional)
 * - Emits: none
 */
const props = withDefaults(defineProps<{
  title: string
  description?: string
}>(), {
  description: '',
})
</script>

<template>
  <section class="empty u-card" role="note" :aria-label="props.title">
    <div class="empty-icon" aria-hidden="true">
      <slot name="icon">
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none">
          <path d="M3 7h18M5 7v10a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
          <path d="M8 7V5a3 3 0 0 1 3-3h2a3 3 0 0 1 3 3v2" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
        </svg>
      </slot>
    </div>
    <div class="empty-content">
      <h3 class="empty-title">{{ props.title }}</h3>
      <p v-if="props.description" class="empty-desc">{{ props.description }}</p>
      <div class="empty-actions">
        <slot name="actions"></slot>
      </div>
    </div>
  </section>
</template>

<style scoped>
.empty {
  display: flex;
  align-items: center;
  gap: .75rem;
}

.empty-icon {
  width: 40px;
  height: 40px;
  color: var(--hc-primary);
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.empty-title {
  margin: 0;
  font-weight: 800;
  letter-spacing: .2px;
}

.empty-desc {
  color: var(--hc-muted);
  margin-top: .125rem;
  margin-bottom: .5rem;
  font-size: .95rem;
}

.empty-actions :deep(.u-btn) {
  margin-right: .25rem;
}
</style>
