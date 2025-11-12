<script setup lang="ts">
import { computed, ref } from 'vue'
import type { PantryItem } from '@/stores/pantry'

/**
 * PUBLIC_INTERFACE
 * PantryList
 * Displays a list of pantry items with filtering, sorting, and row actions.
 *
 * Props:
 *  - items: PantryItem[] items to display
 *  - loading?: boolean shows loading state
 *
 * Emits:
 *  - edit(item: PantryItem)
 *  - delete(id: string)
 *
 * Accessibility:
 *  - Proper table semantics, labeled controls with aria-labels, and keyboard focus styles.
 */
const props = withDefaults(defineProps<{
  items: PantryItem[]
  loading?: boolean
}>(), {
  items: () => [],
  loading: false,
})

const emit = defineEmits<{
  // PUBLIC_INTERFACE
  (e: 'edit', value: PantryItem): void
  (e: 'delete', value: string): void
}>()

// Filters/sorting local state
const q = ref<string>('')
const showExpiringOnly = ref(false)
const sortKey = ref<'name' | 'expiresAt'>('expiresAt')
const sortDir = ref<'asc' | 'desc'>('asc')

// Badge helpers
function daysUntil(dateIso?: string): number | null {
  if (!dateIso) return null
  const t = Date.parse(dateIso)
  if (Number.isNaN(t)) return null
  const diffMs = t - Date.now()
  return Math.round(diffMs / (1000 * 60 * 60 * 24))
}
function isExpiringSoon(item: PantryItem): boolean {
  const d = daysUntil(item.expiresAt)
  return d !== null && d <= 3
}

// Filtering + sorting
const filtered = computed(() => {
  const term = q.value.trim().toLowerCase()
  return props.items.filter((it) => {
    const matchTerm = !term || it.name.toLowerCase().includes(term) || (it.quantity || '').toLowerCase().includes(term)
    const matchExp = !showExpiringOnly.value || isExpiringSoon(it)
    return matchTerm && matchExp
  })
})

const sorted = computed(() => {
  const list = [...filtered.value]
  list.sort((a, b) => {
    let va: string | number = ''
    let vb: string | number = ''
    if (sortKey.value === 'name') {
      va = (a.name || '').toLowerCase()
      vb = (b.name || '').toLowerCase()
    } else if (sortKey.value === 'expiresAt') {
      va = a.expiresAt ? Date.parse(a.expiresAt) : Number.POSITIVE_INFINITY
      vb = b.expiresAt ? Date.parse(b.expiresAt) : Number.POSITIVE_INFINITY
    }
    if (va < vb) return sortDir.value === 'asc' ? -1 : 1
    if (va > vb) return sortDir.value === 'asc' ? 1 : -1
    return 0
  })
  return list
})

// expose reset for parent if needed
// PUBLIC_INTERFACE
function resetFilters() {
  q.value = ''
  showExpiringOnly.value = false
  sortKey.value = 'expiresAt'
  sortDir.value = 'asc'
}
defineExpose({ resetFilters })

function onSort(k: 'name' | 'expiresAt') {
  if (sortKey.value === k) {
    sortDir.value = sortDir.value === 'asc' ? 'desc' : 'asc'
  } else {
    sortKey.value = k
    sortDir.value = 'asc'
  }
}
</script>

<template>
  <section class="plist u-card" aria-labelledby="plist-title">
    <div class="plist__head">
      <h2 id="plist-title" class="plist__title">Pantry Items</h2>
      <div class="controls" role="group" aria-label="Filter and sort pantry items">
        <label class="control">
          <span class="control__label">Search</span>
          <input
            class="input"
            type="search"
            v-model="q"
            placeholder="Find by name or quantity"
            aria-label="Search items by name or quantity"
          />
        </label>
        <label class="control control--checkbox">
          <input
            type="checkbox"
            v-model="showExpiringOnly"
            aria-label="Show expiring soon only"
          />
          <span>Expiring soon</span>
        </label>
        <div class="control">
          <span class="control__label">Sort</span>
          <div class="sort">
            <button
              class="u-btn u-btn--ghost"
              type="button"
              @click="onSort('expiresAt')"
              :aria-pressed="sortKey==='expiresAt'"
            >
              By Expiration
              <span aria-hidden="true">{{ sortKey==='expiresAt' ? (sortDir==='asc' ? '↑' : '↓') : '' }}</span>
            </button>
            <button
              class="u-btn u-btn--ghost"
              type="button"
              @click="onSort('name')"
              :aria-pressed="sortKey==='name'"
            >
              By Name
              <span aria-hidden="true">{{ sortKey==='name' ? (sortDir==='asc' ? '↑' : '↓') : '' }}</span>
            </button>
          </div>
        </div>
      </div>
    </div>

    <div role="status" aria-live="polite" class="status" v-if="loading">Loading pantry…</div>

    <div class="table-wrap" v-if="sorted.length > 0">
      <table class="table" role="table" aria-label="Pantry items">
        <thead>
          <tr>
            <th scope="col">
              <button class="th-btn" @click="onSort('name')" :aria-label="`Sort by name ${sortDir==='asc' && sortKey==='name' ? 'descending' : 'ascending'}`">
                Name
                <span class="muted" aria-hidden="true">{{ sortKey==='name' ? (sortDir==='asc' ? '↑' : '↓') : '' }}</span>
              </button>
            </th>
            <th scope="col">Quantity</th>
            <th scope="col">
              <button class="th-btn" @click="onSort('expiresAt')" :aria-label="`Sort by expiration ${sortDir==='asc' && sortKey==='expiresAt' ? 'descending' : 'ascending'}`">
                Expires
                <span class="muted" aria-hidden="true">{{ sortKey==='expiresAt' ? (sortDir==='asc' ? '↑' : '↓') : '' }}</span>
              </button>
            </th>
            <th scope="col" class="actions-col">Actions</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="it in sorted" :key="it.id">
            <td>
              <div class="namecell">
                <span>{{ it.name }}</span>
                <span v-if="isExpiringSoon(it)" class="badge badge--primary" title="Expiring soon">Soon</span>
              </div>
            </td>
            <td>
              <span>{{ it.quantity || '—' }}</span>
            </td>
            <td>
              <span v-if="it.expiresAt">
                <span>{{ new Date(it.expiresAt).toLocaleDateString() }}</span>
                <span class="muted" v-if="daysUntil(it.expiresAt) !== null"> (in {{ daysUntil(it.expiresAt) }}d)</span>
              </span>
              <span v-else class="muted">—</span>
            </td>
            <td class="actions">
              <button
                type="button"
                class="u-btn u-btn--ghost"
                @click="emit('edit', it)"
                aria-label="Edit item"
              >
                Edit
              </button>
              <button
                type="button"
                class="u-btn u-btn--secondary"
                @click="emit('delete', it.id)"
                aria-label="Delete item"
              >
                Delete
              </button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <p v-else class="empty muted">No items match your filters.</p>
  </section>
</template>

<style scoped>
.plist { display: grid; gap: .6rem; }
.plist__title { font-size: 1.1rem; font-weight: 800; }
.controls {
  display: flex; flex-wrap: wrap; gap: .5rem; align-items: end;
}
.control { display: grid; gap: .25rem; }
.control__label { font-size: .85rem; color: #374151; font-weight: 600; }
.control--checkbox { display: inline-flex; align-items: center; gap: .35rem; }
.input {
  padding: .45rem .6rem; border-radius: var(--hc-radius-sm);
  border: 1px solid var(--hc-border); outline: none; min-width: 230px;
}
.input:focus-visible { box-shadow: 0 0 0 3px var(--hc-ring); }
.sort { display: inline-flex; gap: .25rem; }
.status { color: #374151; }
.table-wrap { overflow-x: auto; border: 1px solid var(--hc-border); border-radius: var(--hc-radius); }
.table { width: 100%; border-collapse: collapse; }
th, td { padding: .5rem; border-bottom: 1px solid var(--hc-border); text-align: left; vertical-align: middle; }
th { background: #f9fafb; font-weight: 700; color: #111827; }
.th-btn { background: transparent; border: 0; font-weight: 700; cursor: pointer; color: #111827; }
.th-btn:focus-visible { outline: none; box-shadow: 0 0 0 3px var(--hc-ring); border-radius: 6px; }
.muted { color: #6b7280; }
.actions-col { width: 180px; }
.actions { display: flex; gap: .35rem; }
.namecell { display: inline-flex; align-items: center; gap: .35rem; }
.empty { padding: .25rem 0; }
</style>
