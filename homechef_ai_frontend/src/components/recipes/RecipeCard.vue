<script setup lang="ts">
import { ref, computed } from 'vue'
import type { RecipeItem } from '@/stores/recipes'

/**
 * PUBLIC_INTERFACE
 * RecipeCard
 * Displays a single recipe preview with title, ingredient list (collapsible), steps (collapsible),
 * and action buttons: Save, Share, View Details.
 *
 * Props:
 *  - recipe: RecipeItem
 *  - saved?: boolean indicates if already saved
 *  - savedTitles?: Set<string> to flag duplicates visually
 *
 * Emits:
 *  - save(recipe)
 *  - share(recipe)
 *  - view(recipe)
 */
const props = withDefaults(defineProps<{
  recipe: RecipeItem
  saved?: boolean
  savedTitles?: Set<string>
}>(), {
  saved: false,
  savedTitles: () => new Set<string>(),
})

const emit = defineEmits<{
  // PUBLIC_INTERFACE
  (e: 'save', value: RecipeItem): void
  (e: 'share', value: RecipeItem): void
  (e: 'view', value: RecipeItem): void
}>()

const showIngredients = ref(true)
const showSteps = ref(false)

const title = computed(() => props.recipe.title || 'Untitled Recipe')
const hasIngredients = computed(() => Array.isArray(props.recipe.ingredients) && props.recipe.ingredients.length > 0)
const hasSteps = computed(() => Array.isArray(props.recipe.steps) && props.recipe.steps.length > 0)
const isDuplicateTitle = computed(() => props.savedTitles?.has(title.value) ?? false)
</script>

<template>
  <article class="card u-surface" :aria-label="`Recipe: ${title}`">
    <header class="card__head">
      <h4 class="card__title">
        {{ title }}
        <span v-if="isDuplicateTitle" class="badge" title="Already saved with this title">Saved</span>
      </h4>
      <p v-if="recipe.description" class="card__desc">{{ recipe.description }}</p>
    </header>

    <div class="card__body">
      <section v-if="hasIngredients" class="section">
        <button
          class="section__t"
          type="button"
          :aria-expanded="showIngredients"
          @click="showIngredients = !showIngredients"
        >
          Ingredients
          <span aria-hidden="true">{{ showIngredients ? '▾' : '▸' }}</span>
        </button>
        <ul v-show="showIngredients" class="list">
          <li v-for="(ing, idx) in recipe.ingredients" :key="idx">
            <span>{{ ing.name }}</span>
            <span v-if="ing.quantity" class="muted"> — {{ ing.quantity }}</span>
          </li>
        </ul>
      </section>

      <section v-if="hasSteps" class="section">
        <button
          class="section__t"
          type="button"
          :aria-expanded="showSteps"
          @click="showSteps = !showSteps"
        >
          Steps
          <span aria-hidden="true">{{ showSteps ? '▾' : '▸' }}</span>
        </button>
        <ol v-show="showSteps" class="list list--ol">
          <li v-for="(st, idx) in recipe.steps" :key="idx">
            <template v-if="typeof st === 'string'">{{ st }}</template>
            <template v-else>
              <strong v-if="st.title">{{ st.title }}: </strong>{{ st.text }}
            </template>
          </li>
        </ol>
      </section>

      <section class="section">
        <div class="nutrition">
          <span class="muted">Nutrition summary</span>
          <span class="muted">—</span>
          <span class="muted">Use Nutrition view to analyze</span>
        </div>
      </section>
    </div>

    <footer class="card__foot">
      <div class="actions">
        <button
          v-if="!saved"
          class="u-btn u-btn--primary"
          type="button"
          @click="emit('save', recipe)"
          aria-label="Save this recipe"
        >
          Save
        </button>
        <button
          class="u-btn u-btn--ghost"
          type="button"
          @click="emit('share', recipe)"
          aria-label="Share this recipe"
        >
          Share
        </button>
        <button
          class="u-btn u-btn--secondary"
          type="button"
          @click="emit('view', recipe)"
          aria-label="View recipe details"
        >
          View Details
        </button>
      </div>
    </footer>
  </article>
</template>

<style scoped>
.card {
  border: 1px solid var(--hc-border);
  border-radius: var(--hc-radius);
  box-shadow: var(--hc-shadow);
  padding: .75rem;
  display: grid;
  gap: .5rem;
  background: var(--hc-surface);
}
.card__title { font-weight: 800; }
.card__desc { color: #4b5563; }

.section { margin-top: .25rem; }
.section__t {
  appearance: none;
  background: #f3f4f6;
  border: 1px solid var(--hc-border);
  border-radius: var(--hc-radius-sm);
  padding: .35rem .5rem;
  font-weight: 700;
  color: #1f2937;
  cursor: pointer;
  display: inline-flex;
  gap: .4rem;
  align-items: center;
}
.section__t:focus-visible {
  outline: none; box-shadow: 0 0 0 3px var(--hc-ring);
}
.list { margin: .35rem 0 0 .5rem; color: #111827; }
.list--ol { list-style: decimal; padding-left: 1.25rem; }
.list li + li { margin-top: .2rem; }
.muted { color: #6b7280; }

.nutrition {
  display: flex;
  gap: .35rem;
  align-items: center;
  font-size: .9rem;
  color: #6b7280;
}

.card__foot .actions {
  display: flex;
  gap: .5rem;
  flex-wrap: wrap;
}
.badge {
  margin-left: .4rem;
  padding: 0 .4rem;
  border-radius: 999px;
  font-size: .7rem;
  background: #dbeafe;
  color: #1e40af;
  border: 1px solid #bfdbfe;
}
</style>
