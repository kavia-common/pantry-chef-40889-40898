import { ref } from 'vue'
import { defineStore } from 'pinia'
import api from '@/services/api'
import { useAppStore } from './app'

export interface NutritionResult {
  calories?: number
  macros?: Record<string, number>
  details?: unknown
}

// PUBLIC_INTERFACE
export const useNutritionStore = defineStore('nutrition', () => {
  const app = useAppStore()

  const currentRecipeNutrition = ref<NutritionResult | null>(null)
  const analyzing = ref(false)

  // PUBLIC_INTERFACE
  async function analyzeRecipe(recipe: unknown) {
    if (analyzing.value) return
    analyzing.value = true
    try {
      const res = await api.nutrition.analyze({ recipe })
      currentRecipeNutrition.value = res
      app.addToast('Nutrition analysis complete', { type: 'success' })
    } catch {
      app.addToast('Failed to analyze nutrition', { type: 'error' })
    } finally {
      analyzing.value = false
    }
  }

  return {
    currentRecipeNutrition,
    analyzing,
    analyzeRecipe,
  }
})

export type NutritionStore = ReturnType<typeof useNutritionStore>
