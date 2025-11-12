import { createRouter, createWebHistory } from 'vue-router'
import HomeView from '../views/HomeView.vue'

/**
 * PUBLIC_INTERFACE
 * Application Router
 * - Routes:
 *   /            -> HomeView (eager)
 *   /recipes     -> RecipesView (lazy)
 *   /pantry      -> PantryView (lazy)
 *   /nutrition   -> NutritionView (lazy)
 *   /settings    -> SettingsView (lazy)
 * - Non-home routes are code-split via dynamic imports.
 */
const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    { path: '/', name: 'home', component: HomeView },
    {
      path: '/recipes',
      name: 'recipes',
      component: () => import('../views/RecipesView.vue'),
    },
    {
      path: '/pantry',
      name: 'pantry',
      component: () => import('../views/PantryView.vue'),
    },
    {
      path: '/nutrition',
      name: 'nutrition',
      component: () => import('../views/NutritionView.vue'),
    },
    {
      path: '/settings',
      name: 'settings',
      component: () => import('../views/SettingsView.vue'),
    },
    // Keep About route to avoid breaking existing links if present
    {
      path: '/about',
      name: 'about',
      component: () => import('../views/AboutView.vue'),
    },
  ],
})

export default router
