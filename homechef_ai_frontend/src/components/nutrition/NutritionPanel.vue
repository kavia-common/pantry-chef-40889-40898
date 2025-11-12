<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useNutritionStore, type NutritionResult } from '@/stores/nutrition'
import { useAppStore } from '@/stores/app'

/**
 * PUBLIC_INTERFACE
 * NutritionPanel
 * Accepts a recipe-like payload and displays a nutrition summary with simple CSS bars.
 *
 * Props:
 *  - recipe?: unknown | RecipeItem
 *  - title?: string (optional heading override)
 *
 * Behavior:
 *  - When Analyze is clicked (or autoAnalyze prop is true), calls nutritionStore.analyzeRecipe(recipe)
 *  - Displays calories and macros as accessible bars with textual values
 *  - Handles loading state and error toasts via app store
 *
 * Accessibility:
 *  - Proper aria-live regions for status
 *  - Bars include text values and aria-valuenow/aria-valuemax for screen readers
 */
const props = withDefaults(defineProps<{
  recipe?: unknown
  title?: string
  autoAnalyze?: boolean
}>(), {
  recipe: undefined,
  title: 'Nutrition Analysis',
  autoAnalyze: false,
})

const app = useAppStore()
const nutrition = useNutritionStore()

const localRecipe = ref<unknown | null>(props.recipe ?? null)

// Keep localRecipe in sync if parent updates prop
watch(() => props.recipe, (v) => { localRecipe.value = v ?? null })

// Optionally auto-analyze if prop toggled true and recipe exists
watch(
  () => [props.autoAnalyze, localRecipe.value],
  async ([auto]) => {
    if (auto && localRecipe.value) {
      try {
        await nutrition.analyzeRecipe(localRecipe.value)
      } catch {
        /* toast handled in store */
      }
    }
  },
  { immediate: true },
)

const hasResult = computed(() => !!nutrition.currentRecipeNutrition)
const result = computed<NutritionResult | null>(() => nutrition.currentRecipeNutrition)

const calories = computed<number>(() => result.value?.calories ?? 0)
const macros = computed<Record<string, number>>(() => result.value?.macros || {})

// Normalize macro keys for display order
const macroOrder = ['protein', 'carbs', 'fat', 'fiber', 'sugar']
function labelForMacro(key: string): string {
  switch (key.toLowerCase()) {
    case 'protein': return 'Protein'
    case 'carbs':
    case 'carbohydrates': return 'Carbs'
    case 'fat': return 'Fat'
    case 'fiber': return 'Fiber'
    case 'sugar': return 'Sugar'
    default: return key[0].toUpperCase() + key.slice(1)
  }
}

const defaultMacroItems = computed(() => {
  const items: Array<{ key: string; label: string; value: number }> = []
  for (const k of macroOrder) {
    const val = macros.value[k]
    if (typeof val === 'number') {
      items.push({ key: k, label: labelForMacro(k), value: val })
    }
  }
  return items
})

const extraMacroItems = computed(() => {
  const items: Array<{ key: string; label: string; value: number }> = []
  for (const [k, v] of Object.entries(macros.value)) {
    const lower = k.toLowerCase()
    if (!macroOrder.includes(lower) && typeof v === 'number') {
      items.push({ key: k, label: labelForMacro(k), value: v })
    }
  }
  return items
})

// Determine max for bar scaling (simple heuristic: max of provided or fallback)
const maxMacro = computed(() => {
  const vals = [
    ...defaultMacroItems.value.map(i => i.value),
    ...extraMacroItems.value.map(i => i.value),
  ]
  const max = vals.length ? Math.max(...vals) : 0
  return Math.max(max, 1)
})

function pctFor(val: number, max: number): number {
  if (!max || max <= 0) return 0
  return Math.max(0, Math.min(100, (val / max) * 100))
}

// PUBLIC_INTERFACE
async function analyze() {
  if (!localRecipe.value) {
    app.addToast('Please select a recipe to analyze.', { type: 'warning' })
    return
  }
  try {
    await nutrition.analyzeRecipe(localRecipe.value)
  } catch {
    // toast handled in store
  }
}
defineExpose({ analyze })
</script>

<template>
  <section class="np u-card" aria-labelledby="np-title">
    <div class="np__head">
      <h2 id="np-title" class="np__title">{{ title }}</h2>
      <div class="np__actions">
        <button
          type="button"
          class="u-btn u-btn--primary"
          :disabled="nutrition.analyzing || !localRecipe"
          @click="analyze"
          aria-label="Analyze nutrition for the selected recipe"
        >
          {{ nutrition.analyzing ? 'Analyzing…' : 'Analyze' }}
        </button>
      </div>
    </div>

    <p v-if="!localRecipe" class="muted" role="status" aria-live="polite">
      Select a recipe to analyze its nutrition.
    </p>

    <div v-if="nutrition.analyzing" class="np__status" role="status" aria-live="assertive">
      Working on your nutrition breakdown…
    </div>

    <div v-if="hasResult" class="np__body">
      <div class="np__cal">
        <div class="cal__num" aria-label="Total calories">
          <strong>{{ calories }}</strong>
          <span class="unit">kcal</span>
        </div>
        <div class="cal__sub muted">Estimated total calories</div>
      </div>

      <div class="np__macros">
        <h3 class="sub">Macros</h3>
        <ul class="macros" role="list">
          <li
            v-for="item in defaultMacroItems"
            :key="item.key"
            class="macro"
          >
            <div class="macro__row">
              <span class="macro__label">{{ item.label }}</span>
              <span class="macro__val">{{ item.value }} g</span>
            </div>
            <div
              class="macro__bar"
              role="progressbar"
              :aria-label="`${item.label} grams`"
              :aria-valuemin="0"
              :aria-valuemax="maxMacro"
              :aria-valuenow="item.value"
            >
              <div class="macro__fill" :style="{ width: pctFor(item.value, maxMacro) + '%' }"></div>
            </div>
          </li>

          <!-- Additional macros not in the default order -->
          <li
            v-for="item in extraMacroItems"
            :key="'extra-' + item.key"
            class="macro"
          >
            <div class="macro__row">
              <span class="macro__label">{{ item.label }}</span>
              <span class="macro__val">{{ item.value }} g</span>
            </div>
            <div
              class="macro__bar"
              role="progressbar"
              :aria-label="`${item.label} grams`"
              :aria-valuemin="0"
              :aria-valuemax="maxMacro"
              :aria-valuenow="item.value"
            >
              <div class="macro__fill" :style="{ width: pctFor(item.value, maxMacro) + '%' }"></div>
            </div>
          </li>
        </ul>
      </div>

      <details v-if="result?.details" class="np__details">
        <summary>Details</summary>
        <pre class="details-pre" aria-label="Raw nutrition details">{{ JSON.stringify(result?.details, null, 2) }}</pre>
      </details>
    </div>
  </section>
</template>

<style scoped>
.np { display: grid; gap: .75rem; }
.np__head { display: flex; align-items: center; justify-content: space-between; gap: .5rem; }
.np__title { font-size: 1.1rem; font-weight: 800; }
.np__actions { display: flex; gap: .5rem; flex-wrap: wrap; }
.np__status { color: #374151; }

.np__body { display: grid; gap: .75rem; }
.np__cal {
  display: inline-flex; align-items: baseline; gap: .35rem;
  background: #f8fafc; border: 1px solid var(--hc-border);
  border-radius: var(--hc-radius); padding: .5rem .6rem;
}
.cal__num strong { font-size: 1.5rem; line-height: 1; }
.unit { color: #6b7280; margin-left: .15rem; }
.cal__sub { color: #6b7280; }

.np__macros { display: grid; gap: .35rem; }
.sub { font-weight: 800; }
.macros { list-style: none; padding-left: 0; display: grid; gap: .4rem; }
.macro__row { display: flex; align-items: center; justify-content: space-between; }
.macro__label { font-weight: 600; color: #374151; }
.macro__val { color: #111827; }

.macro__bar {
  height: 10px;
  background: #eef2ff;
  border: 1px solid #dbeafe;
  border-radius: 999px;
  overflow: hidden;
}
.macro__fill {
  height: 100%;
  background: linear-gradient(90deg, var(--hc-primary), #60a5fa);
  width: 0%;
  transition: width .3s ease;
}

.np__details {
  border-top: 1px solid var(--hc-border);
  padding-top: .5rem;
}
.details-pre {
  background: #0b1220;
  color: #d1d5db;
  padding: .5rem;
  border-radius: var(--hc-radius-sm);
  overflow: auto;
  font-size: .85rem;
}

.muted { color: #6b7280; }
</style>
