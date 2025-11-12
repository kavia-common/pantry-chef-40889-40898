<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import AppShell from '@/components/layout/AppShell.vue'
import IngredientInput from '@/components/ingredients/IngredientInput.vue'
import RecipeGenerator from '@/components/recipes/RecipeGenerator.vue'
import NutritionPanel from '@/components/nutrition/NutritionPanel.vue'
import PantryList from '@/components/pantry/PantryList.vue'
import { usePantryStore } from '@/stores/pantry'
import { useRecipesStore } from '@/stores/recipes'
import { useNutritionStore } from '@/stores/nutrition'

/**
 * HomeView is the primary dashboard of HomeChef AI.
 * It composes Ingredient input, AI recipe generator, nutrition insights, and a pantry overview.
 * The layout is responsive and accessible, with a collapsible pantry drawer on small screens.
 */

// Stores
const pantry = usePantryStore()
const recipes = useRecipesStore()
const nutrition = useNutritionStore()

// Responsive breakpoint handling for mobile drawer
const isMobile = ref(false)
const showPantryDrawer = ref(false)

const handleResize = () => {
  isMobile.value = window.matchMedia('(max-width: 1024px)').matches
}

onMounted(() => {
  handleResize()
  window.addEventListener('resize', handleResize, { passive: true })
  // Prefetch essential data for dashboard readiness
  if (pantry.items.length === 0 && typeof pantry.fetchAll === 'function') {
    pantry.fetchAll().catch(() => {})
  }
  if (typeof recipes.loadSaved === 'function') {
    recipes.loadSaved().catch(() => {})
  }
})

onBeforeUnmount(() => {
  window.removeEventListener('resize', handleResize)
})

// Derive accessible labels and counts
const pantryCount = computed(() => pantry.items?.length ?? 0)
const generatedCount = computed(() => recipes.results?.length ?? 0)
const kcalTotal = computed(() => nutrition.currentRecipeNutrition?.calories ?? 0)
</script>

<template>
  <AppShell>
    <div class="home" :style="{ backgroundColor: 'var(--hc-bg, #f9fafb)' }">
      <!-- Hero/Header -->
      <header
        class="hero"
        role="banner"
        aria-label="HomeChef AI Dashboard"
      >
        <div class="hero-content">
          <div class="hero-text">
            <h1 class="hero-title">HomeChef AI</h1>
            <p class="hero-subtitle">
              Cook smarter with the ingredients you already have.
            </p>
          </div>

          <!-- Mobile Pantry Toggle -->
          <button
            class="pantry-toggle"
            v-if="isMobile"
            @click="showPantryDrawer = true"
            aria-haspopup="dialog"
            :aria-expanded="showPantryDrawer ? 'true' : 'false'"
            aria-controls="pantry-drawer"
          >
            <span class="pantry-toggle-dot" aria-hidden="true"></span>
            Pantry ({{ pantryCount }})
          </button>

          <!-- Desktop quick stats -->
          <div class="quick-stats" role="status" aria-live="polite" v-else>
            <div class="stat">
              <span class="stat-label">Pantry</span>
              <span class="stat-value">{{ pantryCount }}</span>
            </div>
            <div class="stat">
              <span class="stat-label">Recipes</span>
              <span class="stat-value">{{ generatedCount }}</span>
            </div>
            <div class="stat">
              <span class="stat-label">kCal</span>
              <span class="stat-value">{{ Math.round(kcalTotal) }}</span>
            </div>
          </div>
        </div>
      </header>

      <!-- Layout -->
      <div class="dashboard">
        <!-- Sidebar (desktop) -->
        <aside class="sidebar" aria-label="Pantry and Nutrition" v-if="!isMobile">
          <section class="card" aria-labelledby="pantry-heading">
            <div class="card-header">
              <h2 id="pantry-heading" class="card-title">Pantry</h2>
              <span class="badge" :aria-label="`Total pantry items: ${pantryCount}`">{{ pantryCount }}</span>
            </div>
            <!-- Slim PantryList via prop 'compact' if supported -->
            <PantryList :items="pantry.items" :loading="pantry.loading" />
          </section>

          <section class="card" aria-labelledby="nutrition-heading">
            <h2 id="nutrition-heading" class="card-title">Nutrition</h2>
            <NutritionPanel />
          </section>
        </aside>

        <!-- Main content -->
        <main class="main" id="main" tabindex="-1">
          <section class="card" aria-labelledby="ingredients-heading">
            <h2 id="ingredients-heading" class="card-title">Ingredients</h2>
            <IngredientInput v-model="recipes.inputIngredients" />
          </section>

          <section class="card" aria-labelledby="recipes-heading">
            <div class="card-header">
              <h2 id="recipes-heading" class="card-title">Recipes</h2>
              <span class="hint" aria-hidden="true">Powered by AI</span>
            </div>
            <RecipeGenerator />
          </section>
        </main>
      </div>

      <!-- Pantry Drawer (mobile) -->
      <div
        v-if="isMobile"
        class="drawer-backdrop"
        :class="{ open: showPantryDrawer }"
        @click.self="showPantryDrawer = false"
        role="dialog"
        aria-modal="true"
        aria-labelledby="pantry-drawer-title"
        id="pantry-drawer"
      >
        <aside class="drawer" @keydown.esc="showPantryDrawer = false">
          <div class="drawer-header">
            <h2 id="pantry-drawer-title" class="card-title">Pantry</h2>
            <button
              class="icon-btn"
              @click="showPantryDrawer = false"
              aria-label="Close pantry"
              title="Close"
            >
              ✕
            </button>
          </div>
          <div class="drawer-content">
            <PantryList :items="pantry.items" :loading="pantry.loading" />
            <div class="divider" role="separator" aria-hidden="true"></div>
            <h3 class="card-title" id="nutrition-mobile">Nutrition</h3>
            <NutritionPanel aria-labelledby="nutrition-mobile" />
          </div>
        </aside>
      </div>
    </div>
  </AppShell>
</template>

<style scoped>
/* Theme tokens (Ocean Professional) */
:root {
  --hc-primary: #2563EB; /* blue-600 */
  --hc-secondary: #F59E0B; /* amber-500 */
  --hc-error: #EF4444;
  --hc-surface: #ffffff;
  --hc-bg: #f9fafb;
  --hc-text: #111827;
  --hc-muted: #6b7280;
  --hc-border: #e5e7eb;
  --hc-shadow: 0 1px 2px rgba(0,0,0,0.05), 0 8px 24px rgba(37,99,235,0.06);
}

.home {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  padding: 1rem clamp(0.75rem, 2vw, 1.25rem);
}

/* Hero */
.hero {
  background: linear-gradient(90deg, rgba(37,99,235,0.08), rgba(249,250,251,1));
  border: 1px solid var(--hc-border);
  border-radius: 0.75rem;
  padding: 1rem clamp(0.75rem, 2vw, 1.25rem);
  box-shadow: var(--hc-shadow);
}

.hero-content {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  flex-wrap: wrap;
}

.hero-title {
  margin: 0;
  font-size: clamp(1.25rem, 2vw, 1.6rem);
  color: var(--hc-text);
}

.hero-subtitle {
  margin: 0.15rem 0 0 0;
  color: var(--hc-muted);
  font-size: 0.95rem;
}

/* Quick stats (desktop) */
.quick-stats {
  display: flex;
  gap: 0.75rem;
}
.stat {
  display: grid;
  gap: 0.125rem;
  padding: 0.5rem 0.75rem;
  background: var(--hc-surface);
  border: 1px solid var(--hc-border);
  border-radius: 0.5rem;
}
.stat-label {
  color: var(--hc-muted);
  font-size: 0.75rem;
}
.stat-value {
  color: var(--hc-text);
  font-weight: 600;
}

/* Pantry toggle (mobile) */
.pantry-toggle {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  border: 1px solid var(--hc-primary);
  color: var(--hc-primary);
  background: linear-gradient(90deg, rgba(37,99,235,0.06), rgba(255,255,255,1));
  padding: 0.5rem 0.75rem;
  border-radius: 999px;
  cursor: pointer;
  transition: background 200ms ease, box-shadow 200ms ease, transform 120ms ease;
}
.pantry-toggle:hover {
  box-shadow: 0 6px 20px rgba(37,99,235,0.15);
  transform: translateY(-1px);
}
.pantry-toggle:focus-visible {
  outline: 2px solid var(--hc-secondary);
  outline-offset: 2px;
}
.pantry-toggle-dot {
  width: 8px;
  height: 8px;
  border-radius: 999px;
  background: var(--hc-secondary);
  box-shadow: 0 0 0 3px rgba(245,158,11,0.2);
}

/* Grid layout */
.dashboard {
  display: grid;
  grid-template-columns: 320px 1fr;
  gap: 1rem;
}

.sidebar {
  display: grid;
  gap: 1rem;
  align-content: start;
}

.main {
  display: grid;
  gap: 1rem;
  grid-template-rows: auto 1fr;
}

/* Cards */
.card {
  background: var(--hc-surface);
  border: 1px solid var(--hc-border);
  border-radius: 0.75rem;
  padding: 0.9rem;
  box-shadow: var(--hc-shadow);
}
.card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: .5rem;
  margin-bottom: .5rem;
}
.card-title {
  margin: 0;
  font-size: 1.05rem;
  color: var(--hc-text);
}
.badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 1.75rem;
  height: 1.25rem;
  padding: 0 0.4rem;
  border-radius: 0.625rem;
  background: rgba(37,99,235,0.08);
  color: var(--hc-primary);
  border: 1px solid rgba(37,99,235,0.15);
  font-size: 0.75rem;
  font-weight: 600;
}
.hint {
  color: var(--hc-secondary);
  font-size: 0.85rem;
}

/* Drawer (mobile pantry) */
.drawer-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(17,24,39,0.35);
  display: none;
  z-index: 50;
}
.drawer-backdrop.open {
  display: block;
}
.drawer {
  position: absolute;
  right: 0;
  top: 0;
  height: 100%;
  width: min(92vw, 420px);
  background: var(--hc-surface);
  border-left: 1px solid var(--hc-border);
  box-shadow: -12px 0 30px rgba(0,0,0,0.15);
  display: grid;
  grid-template-rows: auto 1fr;
  animation: slideIn 220ms ease;
}
.drawer-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: .9rem;
  border-bottom: 1px solid var(--hc-border);
}
.drawer-content {
  padding: .9rem;
  overflow: auto;
  display: grid;
  gap: .9rem;
}
.icon-btn {
  border: 1px solid var(--hc-border);
  background: var(--hc-surface);
  color: var(--hc-text);
  border-radius: .5rem;
  padding: .25rem .5rem;
  cursor: pointer;
}
.icon-btn:focus-visible {
  outline: 2px solid var(--hc-secondary);
  outline-offset: 2px;
}
.divider {
  height: 1px;
  background: var(--hc-border);
  margin: .25rem 0;
}

@keyframes slideIn {
  from { transform: translateX(20px); opacity: 0; }
  to { transform: translateX(0); opacity: 1; }
}

/* Responsiveness */
@media (max-width: 1024px) {
  .dashboard {
    grid-template-columns: 1fr;
  }
  .sidebar {
    display: none;
  }
  .hero-content {
    align-items: flex-start;
  }
}

/* Reduced motion preferences */
@media (prefers-reduced-motion: reduce) {
  .pantry-toggle,
  .drawer {
    animation: none !important;
    transition: none !important;
  }
}
</style>
