<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRecipesStore, type RecipeItem } from '@/stores/recipes'
import { useNutritionStore } from '@/stores/nutrition'
import NutritionPanel from '@/components/nutrition/NutritionPanel.vue'
import { useAppStore } from '@/stores/app'

/**
 * NutritionView
 * - Pulls in generated and saved recipes from recipes store
 * - Allows selecting one recipe to analyze
 * - Renders NutritionPanel to display the results
 */
const recipes = useRecipesStore()
const nutrition = useNutritionStore()
const app = useAppStore()

const selectedId = ref<string>('')

// Build options from generated + saved
const generated = computed(() => recipes.results || [])
const saved = computed(() =>
  (recipes.savedRecipes || []).map((s) => ({
    id: s.id,
    title: s.title,
    // Saved recipe data might be present; we try to use it if available
    data: (s.data as unknown) as RecipeItem | undefined,
    createdAt: s.createdAt,
  })),
)



const selectedRecipe = computed<RecipeItem | unknown | null>(() => {
  const id = selectedId.value
  if (!id) return null
  // Search generated first
  const g = generated.value.find((r) => (r.id || '').toString() === id)
  if (g) return g
  // Then saved list
  const s = saved.value.find((r) => r.id === id)
  if (s?.data) return s.data
  // If saved entry has no data shape, return a simple structure with title
  if (s) return { id: s.id, title: s.title }
  return null
})

function onAnalyzeClick() {
  if (!selectedRecipe.value) {
    app.addToast('Choose a recipe to analyze', { type: 'warning' })
    return
  }
  nutrition.analyzeRecipe(selectedRecipe.value)
}

onMounted(() => {
  // Ensure we have saved list for selection
  recipes.loadSaved().catch(() => { /* toast in store */ })
})
</script>

<template>
  <section class="container nv" style="padding-top:.5rem; padding-bottom:.5rem;">
    <div class="nv__head u-card">
      <div class="nv__text">
        <h1 class="nv__title">Nutrition</h1>
        <p class="nv__desc">Analyze a recipe to estimate calories and macros.</p>
      </div>

      <div class="nv__controls" role="group" aria-label="Select recipe to analyze">
        <label class="nv__select">
          <span class="nv__label">Recipe</span>
          <select
            class="nv__select-el"
            v-model="selectedId"
            :aria-label="'Select a recipe to analyze'"
          >
            <option value="" disabled>Select a recipe…</option>
            <optgroup label="Generated">
              <option
                v-for="r in generated"
                :key="(r.id || 'gen') + '-' + (r.title || '')"
                :value="r.id || ''"
              >{{ r.title || 'Generated Recipe' }}</option>
            </optgroup>
            <optgroup label="Saved">
              <option
                v-for="s in saved"
                :key="s.id"
                :value="s.id"
              >{{ s.title || 'Saved Recipe' }}</option>
            </optgroup>
          </select>
        </label>

        <button
          class="u-btn u-btn--primary"
          type="button"
          :disabled="!selectedRecipe || nutrition.analyzing"
          @click="onAnalyzeClick"
          aria-label="Analyze selected recipe"
        >
          {{ nutrition.analyzing ? 'Analyzing…' : 'Analyze' }}
        </button>
      </div>
    </div>

    <div class="nv__panel">
      <NutritionPanel
        :recipe="selectedRecipe || undefined"
        :title="selectedRecipe && (selectedRecipe as any).title ? `Nutrition — ${(selectedRecipe as any).title}` : 'Nutrition Analysis'"
      />
    </div>
  </section>
</template>

<style scoped>
.nv { display: grid; gap: .75rem; }
.nv__head { display: grid; gap: .5rem; }
.nv__title { font-size: 1.4rem; font-weight: 800; }
.nv__desc { color: #4b5563; }
.nv__controls { display: flex; align-items: end; gap: .5rem; flex-wrap: wrap; }

.nv__select { display: grid; gap: .25rem; }
.nv__label { font-size: .85rem; color: #374151; font-weight: 600; }
.nv__select-el {
  padding: .45rem .6rem; border-radius: var(--hc-radius-sm);
  border: 1px solid var(--hc-border); outline: none; min-width: 240px; background: #fff;
}
.nv__select-el:focus-visible { box-shadow: 0 0 0 3px var(--hc-ring); }

.nv__panel { }
</style>
