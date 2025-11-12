import { ref, computed } from 'vue'
import { defineStore } from 'pinia'
import api from '@/services/api'
import { useAppStore } from './app'

export interface PantryItem {
  id: string
  name: string
  quantity?: string
  expiresAt?: string // ISO string
}

// PUBLIC_INTERFACE
export const usePantryStore = defineStore('pantry', () => {
  const app = useAppStore()

  const items = ref<PantryItem[]>([])
  const loading = ref(false)

  // Items expiring in <= N days (default: 3)
  const soonToExpire = computed(() => {
    const now = Date.now()
    const thresholdDays = 3
    const threshold = now + thresholdDays * 24 * 60 * 60 * 1000
    return items.value.filter((it) => {
      if (!it.expiresAt) return false
      const t = Date.parse(it.expiresAt)
      if (Number.isNaN(t)) return false
      return t <= threshold
    })
  })

  // PUBLIC_INTERFACE
  async function fetchAll() {
    loading.value = true
    try {
      const list = await api.pantry.list()
      items.value = list
    } catch {
      app.addToast('Failed to load pantry', { type: 'error' })
    } finally {
      loading.value = false
    }
  }

  // PUBLIC_INTERFACE
  async function add(item: Omit<PantryItem, 'id'>) {
    try {
      const created = await api.pantry.create({ name: item.name, quantity: item.quantity, expiresAt: item.expiresAt })
      items.value.unshift(created)
      app.addToast('Added to pantry', { type: 'success' })
    } catch {
      app.addToast('Unable to add item', { type: 'error' })
    }
  }

  // PUBLIC_INTERFACE
  async function update(id: string, updates: Partial<Omit<PantryItem, 'id'>>) {
    try {
      const updated = await api.pantry.update(id, updates)
      const idx = items.value.findIndex((i) => i.id === id)
      if (idx >= 0) items.value[idx] = updated
      app.addToast('Updated item', { type: 'success' })
    } catch {
      app.addToast('Unable to update item', { type: 'error' })
    }
  }

  // PUBLIC_INTERFACE
  async function remove(id: string) {
    try {
      await api.pantry.remove(id)
      const idx = items.value.findIndex((i) => i.id === id)
      if (idx >= 0) items.value.splice(idx, 1)
      app.addToast('Removed item', { type: 'success' })
    } catch {
      app.addToast('Unable to remove item', { type: 'error' })
    }
  }

  return {
    items,
    loading,
    soonToExpire,

    fetchAll,
    add,
    update,
    remove,
  }
})

export type PantryStore = ReturnType<typeof usePantryStore>
