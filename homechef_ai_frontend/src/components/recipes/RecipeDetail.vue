<script setup lang="ts">
import { computed, watch, onMounted, onBeforeUnmount } from 'vue'
import type { RecipeItem } from '@/stores/recipes'

/**
 * PUBLIC_INTERFACE
 * RecipeDetail
 * Accessible modal dialog that shows a detailed view of a recipe.
 *
 * Props:
 *  - modelValue: boolean (open/close)
 *  - recipe: RecipeItem
 *
 * Emits:
 *  - update:modelValue(boolean)
 */
const props = defineProps<{
  modelValue: boolean
  recipe: RecipeItem
}>()
const emit = defineEmits<{
  // PUBLIC_INTERFACE
  (e: 'update:modelValue', value: boolean): void
}>()

const title = computed(() => props.recipe?.title || 'Recipe')

function close() {
  emit('update:modelValue', false)
}

function onKey(e: KeyboardEvent) {
  if (e.key === 'Escape') {
    e.preventDefault()
    close()
  }
}

watch(() => props.modelValue, (open) => {
  if (typeof document !== 'undefined') {
    document.body.style.overflow = open ? 'hidden' : ''
  }
})

onMounted(() => {
  if (typeof window !== 'undefined') {
    window.addEventListener('keydown', onKey)
  }
})
onBeforeUnmount(() => {
  if (typeof window !== 'undefined') {
    window.removeEventListener('keydown', onKey)
  }
  if (typeof document !== 'undefined') {
    document.body.style.overflow = ''
  }
})
</script>

<template>
  <div v-if="modelValue" class="modal" role="dialog" :aria-label="`Details for ${title}`" aria-modal="true">
    <div class="overlay" @click="close" aria-hidden="true"></div>
    <div class="dialog u-surface" role="document">
      <header class="dialog__head">
        <h3 class="dialog__title">{{ title }}</h3>
        <button class="u-btn u-btn--ghost" type="button" @click="close" aria-label="Close details dialog">✕</button>
      </header>

      <div class="dialog__body">
        <p v-if="recipe.description" class="muted" style="margin-bottom:.5rem;">{{ recipe.description }}</p>

        <section v-if="recipe.ingredients?.length">
          <h4 class="sub">Ingredients</h4>
          <ul class="list">
            <li v-for="(ing, idx) in recipe.ingredients" :key="idx">
              <span>{{ ing.name }}</span>
              <span v-if="ing.quantity" class="muted"> — {{ ing.quantity }}</span>
            </li>
          </ul>
        </section>

        <section v-if="recipe.steps?.length" style="margin-top:.5rem;">
          <h4 class="sub">Steps</h4>
          <ol class="list list--ol">
            <li v-for="(st, idx) in recipe.steps" :key="idx">
              <template v-if="typeof st === 'string'">{{ st }}</template>
              <template v-else>
                <strong v-if="st.title">{{ st.title }}: </strong>{{ st.text }}
              </template>
            </li>
          </ol>
        </section>
      </div>

      <footer class="dialog__foot">
        <button class="u-btn u-btn--secondary" type="button" @click="close">Close</button>
      </footer>
    </div>
  </div>
</template>

<style scoped>
.modal {
  position: fixed;
  inset: 0;
  z-index: 50;
}
.overlay {
  position: absolute;
  inset: 0;
  background: rgba(17,24,39,.45);
  backdrop-filter: blur(1px);
}
.dialog {
  position: relative;
  background: var(--hc-surface);
  border: 1px solid var(--hc-border);
  border-radius: var(--hc-radius);
  box-shadow: 0 10px 25px rgba(0,0,0,.15);
  width: min(720px, calc(100vw - 2rem));
  max-height: calc(100vh - 2rem);
  overflow: auto;
  margin: 1rem auto 0 auto;
  padding: .75rem;
}
.dialog__head {
  display: flex; align-items: center; justify-content: space-between;
  border-bottom: 1px solid var(--hc-border);
  padding-bottom: .5rem;
}
.dialog__title { font-weight: 800; }
.dialog__body { padding-top: .5rem; }
.dialog__foot { display: flex; justify-content: flex-end; gap: .5rem; padding-top: .5rem; border-top: 1px solid var(--hc-border); }

.sub { font-weight: 800; }
.list { margin-top: .25rem; padding-left: 1rem; }
.list--ol { list-style: decimal; }
.muted { color: #6b7280; }
</style>
