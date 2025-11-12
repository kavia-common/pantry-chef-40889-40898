import { ref, computed } from 'vue'
import { defineStore } from 'pinia'
import api from '@/services/api'
import ws from '@/services/ws'
import { useAppStore } from './app'

export type GenerationStatus = 'idle' | 'queued' | 'processing' | 'streaming' | 'ready' | 'error'

export interface RecipeItem {
  id?: string
  title?: string
  description?: string
  ingredients?: Array<{ name: string; quantity?: string }>
  steps?: string[] | Array<{ title?: string; text?: string }>
  meta?: Record<string, unknown>
}

export interface GeneratePayload {
  ingredients: string[] // or richer structure; use string list for simplicity
  preferences?: Record<string, unknown>
}

// PUBLIC_INTERFACE
export const useRecipesStore = defineStore('recipes', () => {
  const app = useAppStore()

  // Input and state
  const inputIngredients = ref<string[]>([])
  const generationStatus = ref<GenerationStatus>('idle')
  const lastGenerationId = ref<string | null>(null)
  const results = ref<RecipeItem[]>([])
  const savedRecipes = ref<Array<{ id: string; title: string; data?: unknown; createdAt?: string }>>([])

  const isGenerating = computed(() => generationStatus.value === 'queued' || generationStatus.value === 'processing' || generationStatus.value === 'streaming')

  // PUBLIC_INTERFACE
  async function generate(payload?: Partial<GeneratePayload>) {
    if (isGenerating.value) return
    generationStatus.value = 'queued'
    results.value = []
    try {
      const body: GeneratePayload = {
        ingredients: payload?.ingredients ?? inputIngredients.value,
        preferences: payload?.preferences ?? {},
      }
      const res = await api.recipes.generate(body)
      lastGenerationId.value = res.id
      generationStatus.value = res.status === 'ready' ? 'ready' : 'processing'
      // If immediate recipes provided
      if (Array.isArray(res.recipes)) {
        results.value = (res.recipes as unknown as RecipeItem[]) ?? []
      }
      // If WS streaming enabled and flag allows, attempt to connect and receive tokens/chunks
      if (app.wsEnabled && lastGenerationId.value) {
        // Use WS for progressive updates if service is configured
        const connected = ws.connect()
        if (connected) {
          generationStatus.value = 'streaming'
          const offStatus = ws.onStatusChange((s) => {
            if (s === 'error' || s === 'closed' || s === 'disabled') {
              if (generationStatus.value === 'streaming') {
                generationStatus.value = 'processing'
              }
              offStatus()
            }
          })
          const unsub = ws.subscribe((msg) => {
            // Expect message to be structured; handle flexible payloads:
            // { type: 'recipe_chunk', item?: RecipeItem, append?: boolean }
            try {
              if (msg && typeof msg === 'object') {
                const obj = msg as Record<string, unknown>
                // Filter to generation id if provided
                const idMatch = !obj['id'] || obj['id'] === lastGenerationId.value
                if (!idMatch) return
                if (obj['type'] === 'recipe_chunk' && obj['item']) {
                  const item = obj['item'] as RecipeItem
                  results.value.push(item)
                } else if (obj['type'] === 'recipes_complete') {
                  generationStatus.value = 'ready'
                  unsub()
                  offStatus()
                }
              }
            } catch {
              // ignore malformed chunk
            }
          })
          // Notify server we want to stream for this id, if backend expects it
          ws.send({ action: 'subscribe', topic: 'recipes', id: lastGenerationId.value })
        }
      }
    } catch {
      generationStatus.value = 'error'
      app.addToast('Failed to generate recipes.', { type: 'error' })
    }
  }

  // PUBLIC_INTERFACE
  async function save(recipe: RecipeItem) {
    try {
      const resp = await api.savedRecipes.create({ data: recipe, title: recipe.title })
      // Maintain a local list; real app would reload from server
      savedRecipes.value.unshift({ id: resp.id, title: recipe.title || 'Recipe', data: recipe, createdAt: new Date().toISOString() })
      app.addToast('Recipe saved', { type: 'success' })
    } catch {
      app.addToast('Could not save recipe', { type: 'error' })
    }
  }

  // PUBLIC_INTERFACE
  async function share(recipe: RecipeItem) {
    // Minimal: use Web Share API if available
    try {
      const text =
        `Check out this recipe: ${recipe.title || 'Untitled'}\n` +
        (Array.isArray(recipe.ingredients)
          ? 'Ingredients: ' + recipe.ingredients.map((i) => i.name + (i.quantity ? ` (${i.quantity})` : '')).join(', ') + '\n'
          : '') +
        (Array.isArray(recipe.steps) ? 'Steps: ' + recipe.steps.map((s) => (typeof s === 'string' ? s : s.text || '')).join(' | ') : '')
      if (
        typeof navigator !== 'undefined' &&
        (navigator as unknown as { share?: (data: { title?: string; text?: string; url?: string }) => Promise<void> }).share
      ) {
        await (navigator as unknown as { share: (d: { title?: string; text?: string; url?: string }) => Promise<void> }).share({
          title: recipe.title || 'Recipe',
          text,
        })
        app.addToast('Shared recipe', { type: 'success' })
      } else {
        await navigator.clipboard.writeText(text)
        app.addToast('Copied recipe to clipboard', { type: 'success' })
      }
    } catch {
      app.addToast('Unable to share recipe', { type: 'error' })
    }
  }

  // PUBLIC_INTERFACE
  async function loadSaved() {
    try {
      const list = await api.savedRecipes.list()
      savedRecipes.value = list.map((r) => ({ id: r.id, title: r.title, createdAt: r.createdAt }))
    } catch {
      app.addToast('Failed to load saved recipes', { type: 'error' })
    }
  }

  return {
    inputIngredients,
    generationStatus,
    isGenerating,
    results,
    savedRecipes,

    generate,
    save,
    share,
    loadSaved,
  }
})

export type RecipesStore = ReturnType<typeof useRecipesStore>
