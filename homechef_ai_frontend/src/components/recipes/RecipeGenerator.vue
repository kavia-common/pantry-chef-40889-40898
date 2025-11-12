<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRecipesStore, type RecipeItem } from '@/stores/recipes'
import { useAppStore } from '@/stores/app'
import IngredientInput from '@/components/ingredients/IngredientInput.vue'
import RecipeCard from './RecipeCard.vue'
import RecipeDetail from './RecipeDetail.vue'

/**
 * PUBLIC_INTERFACE
 * RecipeGenerator
 * High-level orchestrator for generating recipes from ingredients.
 * - Integrates with recipes store (generate, results, save/share, savedRecipes list)
 * - Uses IngredientInput for gathering ingredients (text/photo/voice)
 * - Renders RecipeCard for each generated or saved recipe
 * - Provides an accessible modal (RecipeDetail) for a selected recipe
 *
 * Props:
 *  - dense?: boolean (optional) use compact layout
 *
 * Emits: none
 */
withDefaults(defineProps<{ dense?: boolean }>(), { dense: false })

const app = useAppStore()
const recipes = useRecipesStore()

// Local selection for detail modal
const showDetail = ref(false)
const selected = ref<RecipeItem | null>(null)

// Computed for buttons / state
const canGenerate = computed(() => recipes.inputIngredients.length > 0 && !recipes.isGenerating)
const isStreaming = computed(() => recipes.generationStatus === 'streaming')
const isProcessing = computed(() => recipes.generationStatus === 'processing' || recipes.generationStatus === 'queued')
const hasResults = computed(() => (recipes.results?.length || 0) > 0)
const hasSaved = computed(() => (recipes.savedRecipes?.length || 0) > 0)

function openDetail(item: RecipeItem) {
  selected.value = item
  showDetail.value = true
}
function closeDetail() {
  showDetail.value = false
  selected.value = null
}

// Forward store actions
async function onGenerate() {
  await recipes.generate()
}
async function onSave(item: RecipeItem) {
  await recipes.save(item)
}
async function onShare(item: RecipeItem) {
  await recipes.share(item)
}

// lifecycle
onMounted(() => {
  // Prefetch saved list once
  recipes.loadSaved().catch(() => {
    /* toast handled in store */
  })
})
</script>

<template>
  <section class="u-card rg" aria-labelledby="rg-title">
    <div class="rg__head">
      <h2 id="rg-title" class="rg__title">Recipe Generator</h2>
      <p class="rg__desc">Add ingredients, then let HomeChef AI suggest delicious recipes.</p>
    </div>

    <div class="rg__input">
      <IngredientInput
        v-model="recipes.inputIngredients"
        label="Ingredients for recipe generation"
        placeholder="e.g., chicken, tomato, basil"
        @photo:parsing="(parsing) => parsing && app.addToast('Parsing photo…')"
        @voice:recording="(rec) => app.addToast(rec ? 'Listening…' : 'Stopped listening', { type: rec ? 'info' : 'warning', timeoutMs: 2000 })"
      />
      <div class="rg__actions">
        <button
          class="u-btn u-btn--primary"
          :disabled="!canGenerate"
          @click="onGenerate"
          aria-label="Generate recipes based on the listed ingredients"
        >
          {{ recipes.isGenerating ? (isStreaming ? 'Streaming…' : 'Generating…') : 'Generate Recipes' }}
        </button>
        <span class="rg__status" role="status" aria-live="polite">
          <template v-if="isStreaming">Receiving ideas via live stream…</template>
          <template v-else-if="isProcessing">Working on your recipes…</template>
          <template v-else-if="recipes.generationStatus==='ready' && hasResults">Done. {{ recipes.results.length }} recipe{{ recipes.results.length>1?'s':'' }} ready.</template>
          <template v-else>&nbsp;</template>
        </span>
      </div>
    </div>

    <div class="rg__results" v-if="hasResults">
      <h3 class="rg__sub">Generated Recipes</h3>
      <div class="rg__grid">
        <RecipeCard
          v-for="(r, idx) in recipes.results"
          :key="(r.id || 'gen') + '-' + idx"
          :recipe="r"
          :savedTitles="new Set(recipes.savedRecipes.map(s => s.title || ''))"
          @save="onSave"
          @share="onShare"
          @view="openDetail"
        />
      </div>
    </div>

    <div class="rg__saved" v-if="hasSaved">
      <h3 class="rg__sub">Saved Recipes</h3>
      <div class="rg__grid">
        <RecipeCard
          v-for="s in recipes.savedRecipes"
          :key="s.id"
          :recipe="{ id: s.id, title: s.title, meta: { savedAt: s.createdAt, source: 'saved' }, ...((s.data as any) || {}) }"
          saved
          :savedTitles="new Set(recipes.savedRecipes.map(ss => ss.title || ''))"
          @share="onShare"
          @view="openDetail"
        />
      </div>
    </div>

    <RecipeDetail
      v-if="showDetail && selected"
      :modelValue="showDetail"
      :recipe="selected"
      @update:modelValue="(v:boolean)=> v ? (showDetail=true) : closeDetail()"
    />
  </section>
</template>

<style scoped>
.rg { display: grid; gap: .75rem; }
.rg__head { display: grid; gap: .25rem; }
.rg__title { font-size: 1.25rem; font-weight: 800; }
.rg__desc { color: #6b7280; }

.rg__input { display: grid; gap: .5rem; }
.rg__actions { display: flex; align-items: center; gap: .5rem; }
.rg__status { color: #374151; min-height: 1.25rem; }

.rg__sub { font-weight: 800; margin-top: .25rem; }
.rg__grid {
  display: grid;
  grid-template-columns: repeat(1, minmax(0,1fr));
  gap: .75rem;
}
@media (min-width: 768px) {
  .rg__grid {
    grid-template-columns: repeat(2, minmax(0,1fr));
  }
}
@media (min-width: 1024px) {
  .rg__grid {
    grid-template-columns: repeat(3, minmax(0,1fr));
  }
}
</style>
