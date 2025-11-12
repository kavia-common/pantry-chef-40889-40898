<script setup lang="ts">
import { computed, onMounted, ref, watchEffect } from 'vue'
import { useRecipesStore, type RecipeItem } from '@/stores/recipes'
import { useAppStore } from '@/stores/app'
import RecipeGenerator from '@/components/recipes/RecipeGenerator.vue'
import RecipeCard from '@/components/recipes/RecipeCard.vue'
import RecipeDetail from '@/components/recipes/RecipeDetail.vue'

/**
 * RecipesView
 * - Top section: RecipeGenerator (ingredients input + generation)
 * - Saved Recipes: searchable and filterable list from recipes store
 *   - Search by title and ingredient
 *   - Tag filters (basic tags derived from ingredients and simple heuristics)
 *   - Actions: View details (modal), Share, Remove from saved
 */

const recipes = useRecipesStore()
const app = useAppStore()

// UI state for Saved Recipes filters
const query = ref<string>('')
const selectedTags = ref<Set<string>>(new Set())
const availableTags = ref<string[]>([])

// Derived helpers
const savedRaw = computed(() => recipes.savedRecipes || [])

// Build a lightweight RecipeItem view from saved entry data if present; fallback to title-only
const savedAsRecipe = computed<RecipeItem[]>(() => {
  return savedRaw.value.map((s) => {
    const data = (s.data as unknown as RecipeItem | undefined) || undefined
    if (data && typeof data === 'object') {
      // Ensure id/title present
      return {
        id: s.id,
        title: data.title || s.title,
        description: data.description,
        ingredients: Array.isArray(data.ingredients) ? data.ingredients : [],
        steps: Array.isArray(data.steps) ? data.steps : [],
        meta: { ...((data.meta || {}) as Record<string, unknown>), savedAt: s.createdAt, source: 'saved' },
      } as RecipeItem
    }
    return {
      id: s.id,
      title: s.title || 'Saved Recipe',
      meta: { savedAt: s.createdAt, source: 'saved' },
    }
  })
})

// Simple tag extraction: collect unique normalized ingredient names + basic heuristic tags by title
function rebuildAvailableTags() {
  const tags = new Set<string>()
  for (const r of savedAsRecipe.value) {
    // Ingredient tags
    if (Array.isArray(r.ingredients)) {
      for (const ing of r.ingredients) {
        const n = String(ing?.name || '').trim().toLowerCase()
        if (n) tags.add(n)
      }
    }
    // Title heuristics (protein types / cuisines)
    const t = String(r.title || '').toLowerCase()
    const heuristics = [
      'chicken', 'beef', 'pork', 'tofu', 'fish', 'shrimp',
      'vegan', 'vegetarian',
      'pasta', 'salad', 'soup',
      'italian', 'mexican', 'indian', 'thai', 'chinese', 'japanese', 'mediterranean',
      'breakfast', 'lunch', 'dinner',
    ]
    for (const h of heuristics) {
      if (t.includes(h)) tags.add(h)
    }
  }
  availableTags.value = Array.from(tags).sort()
}

onMounted(() => {
  // Load saved recipes on view mount
  recipes.loadSaved().then(() => {
    rebuildAvailableTags()
  }).catch(() => {
    // toast handled in store
  })
})

// Recompute tags when saved list updates
const savedCount = computed(() => savedAsRecipe.value.length)
watchEffect(() => {
  // triggers when savedAsRecipe changes
  // we preserve selected tags if still present; otherwise drop removed tags
  const before = new Set(selectedTags.value)
  rebuildAvailableTags()
  const nextSel = new Set<string>()
  for (const tag of before) {
    if (availableTags.value.includes(tag)) nextSel.add(tag)
  }
  selectedTags.value = nextSel
})

// Filtering logic
const normalizedQuery = computed(() => query.value.trim().toLowerCase())

const filteredSaved = computed<RecipeItem[]>(() => {
  const q = normalizedQuery.value
  const tags = selectedTags.value
  const hasTagFilter = tags.size > 0

  return savedAsRecipe.value.filter((r) => {
    // query by title or ingredient
    const title = String(r.title || '').toLowerCase()
    const ingredientNames = (Array.isArray(r.ingredients) ? r.ingredients : []).map((i) => String(i.name || '').toLowerCase())
    const matchesQuery =
      !q ||
      title.includes(q) ||
      ingredientNames.some((n) => n.includes(q))

    if (!matchesQuery) return false

    if (!hasTagFilter) return true

    // tag filter: require all selected tags to appear in title or ingredients
    const haystack = new Set<string>([
      ...ingredientNames,
      ...title.split(/\s+/g).filter(Boolean),
    ])
    for (const tag of tags) {
      if (!haystack.has(tag)) {
        return false
      }
    }
    return true
  })
})

// Detail modal state
const showDetail = ref(false)
const selected = ref<RecipeItem | null>(null)

function openDetail(item: RecipeItem) {
  selected.value = item
  showDetail.value = true
}
function closeDetail() {
  showDetail.value = false
  selected.value = null
}

// Actions
async function onShare(item: RecipeItem) {
  await recipes.share(item)
}
async function onRemoveFromSaved(item: RecipeItem) {
  // Since store currently doesn't expose a removeSaved, we emulate removal by client-side filter
  // In real integration, this would call an API and then reload saved list.
  const id = String(item.id || '')
  const idx = recipes.savedRecipes.findIndex((s) => s.id === id)
  if (idx >= 0) {
    recipes.savedRecipes.splice(idx, 1)
    app.addToast('Removed from saved', { type: 'success' })
  } else {
    app.addToast('Could not remove saved recipe', { type: 'error' })
  }
}

function toggleTag(tag: string) {
  const sel = new Set(selectedTags.value)
  if (sel.has(tag)) sel.delete(tag)
  else sel.add(tag)
  selectedTags.value = sel
}

function isTagSelected(tag: string) {
  return selectedTags.value.has(tag)
}
</script>

<template>
  <section class="container" style="padding-top:.5rem; padding-bottom:.5rem;">
    <!-- Generator -->
    <RecipeGenerator />

    <!-- Saved Recipes -->
    <div class="saved u-card" style="margin-top:.75rem;">
      <div class="saved__head">
        <div class="saved__title">
          <h2 class="title">Saved Recipes</h2>
          <span class="muted">({{ savedCount }})</span>
        </div>

        <div class="saved__filters" role="group" aria-label="Filter saved recipes">
          <label class="field">
            <span class="label">Search</span>
            <input
              class="input"
              type="search"
              v-model="query"
              placeholder="Search by title or ingredient"
              aria-label="Search saved recipes by title or ingredient"
            />
          </label>

          <div class="tags">
            <span class="label">Tags</span>
            <div class="taglist" role="list">
              <button
                v-for="t in availableTags"
                :key="t"
                class="tag"
                :class="{ 'is-selected': isTagSelected(t) }"
                type="button"
                @click="toggleTag(t)"
                :aria-pressed="isTagSelected(t)"
              >
                {{ t }}
              </button>
            </div>
          </div>
        </div>
      </div>

      <div v-if="filteredSaved.length > 0" class="grid">
        <article v-for="r in filteredSaved" :key="r.id" class="item">
          <RecipeCard
            :recipe="r"
            saved
            :savedTitles="new Set(savedAsRecipe.map(s => s.title || ''))"
            @share="onShare"
            @view="openDetail"
          />
          <div class="row-actions">
            <button
              class="u-btn u-btn--ghost"
              type="button"
              @click="onShare(r)"
              aria-label="Share saved recipe"
            >
              Share
            </button>
            <button
              class="u-btn u-btn--secondary"
              type="button"
              @click="openDetail(r)"
              aria-label="View saved recipe details"
            >
              Details
            </button>
            <button
              class="u-btn u-btn--ghost"
              type="button"
              @click="onRemoveFromSaved(r)"
              aria-label="Remove from saved recipes"
            >
              Remove
            </button>
          </div>
        </article>
      </div>

      <p v-else class="empty muted">No saved recipes match your filters.</p>
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
.saved { display: grid; gap: .6rem; }
.saved__head { display: grid; gap: .5rem; }
.saved__title { display: inline-flex; align-items: baseline; gap: .35rem; }
.title { font-size: 1.15rem; font-weight: 800; }
.muted { color: #6b7280; }

.saved__filters { display: flex; align-items: end; gap: .5rem; flex-wrap: wrap; }
.field { display: grid; gap: .25rem; }
.label { font-size: .85rem; color: #374151; font-weight: 600; }
.input {
  padding: .45rem .6rem; border-radius: var(--hc-radius-sm);
  border: 1px solid var(--hc-border); outline: none; min-width: 240px; background: #fff;
}
.input:focus-visible { box-shadow: 0 0 0 3px var(--hc-ring); }

.tags { display: grid; gap: .25rem; }
.taglist { display: flex; gap: .35rem; flex-wrap: wrap; }
.tag {
  appearance: none;
  background: #f3f4f6;
  border: 1px solid var(--hc-border);
  border-radius: 999px;
  padding: .25rem .6rem;
  font-weight: 600;
  color: #374151;
  cursor: pointer;
}
.tag.is-selected {
  background: #dbeafe;
  border-color: #bfdbfe;
  color: #1e40af;
}
.tag:focus-visible { outline: none; box-shadow: 0 0 0 3px var(--hc-ring); }

.grid {
  display: grid;
  grid-template-columns: repeat(1, minmax(0, 1fr));
  gap: .75rem;
}
@media (min-width: 768px) {
  .grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
}
@media (min-width: 1024px) {
  .grid { grid-template-columns: repeat(3, minmax(0, 1fr)); }
}
.item { display: grid; gap: .35rem; }
.row-actions { display: flex; gap: .35rem; flex-wrap: wrap; }

.empty { padding: .25rem 0; }
</style>
