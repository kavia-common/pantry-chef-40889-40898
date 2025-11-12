<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { usePantryStore, type PantryItem } from '@/stores/pantry'

import PantryList from '@/components/pantry/PantryList.vue'
import PantryItemForm from '@/components/pantry/PantryItemForm.vue'

/**
 * PantryView
 * Provides full CRUD experience for pantry items:
 *  - Lists items with filters/sort and "expiring soon" badges (via PantryList)
 *  - Add new item (PantryItemForm in create mode)
 *  - Edit existing (PantryItemForm in edit mode)
 *  - Delete items with confirmation
 *  - Loads items on mount using pantry store
 */
const pantry = usePantryStore()

const showForm = ref(false)
const editItem = ref<PantryItem | null>(null)
const isSaving = ref(false)

onMounted(() => {
  pantry.fetchAll()
})

function onAddClick() {
  editItem.value = null
  showForm.value = true
}

function onEdit(item: PantryItem) {
  editItem.value = item
  showForm.value = true
}

async function onDelete(id: string) {
  const ok = confirm('Remove this item from your pantry?')
  if (!ok) return
  await pantry.remove(id)
}

async function onSubmit(payload: { name: string; quantity?: string; expiresAt?: string }) {
  isSaving.value = true
  try {
    if (editItem.value) {
      await pantry.update(editItem.value.id, payload)
    } else {
      await pantry.add(payload as Omit<PantryItem, 'id'>)
    }
    showForm.value = false
    editItem.value = null
  } finally {
    isSaving.value = false
  }
}
</script>

<template>
  <section class="container" style="padding-top:.5rem; padding-bottom:.5rem;">
    <div class="pv-head u-card">
      <div class="pv-head__text">
        <h1 class="pv-title">Pantry</h1>
        <p class="pv-desc">Manage your pantry inventory and track expiration dates.</p>
      </div>
      <div class="pv-actions">
        <button class="u-btn u-btn--primary" @click="onAddClick" aria-label="Add pantry item">Add Item</button>
      </div>
    </div>

    <div class="pv-grid">
      <div class="pv-main">
        <PantryList
          :items="pantry.items"
          :loading="pantry.loading"
          @edit="onEdit"
          @delete="onDelete"
        />
      </div>
      <aside class="pv-side">
        <div class="u-card">
          <h3 class="side-title">Expiring Soon</h3>
          <ul v-if="pantry.soonToExpire.length" class="soon-list">
            <li v-for="it in pantry.soonToExpire" :key="it.id">
              <div class="soon-row">
                <span>{{ it.name }}</span>
                <span class="badge badge--primary">Soon</span>
              </div>
              <div class="soon-sub muted">
                <span v-if="it.expiresAt">{{ new Date(it.expiresAt).toLocaleDateString() }}</span>
                <span v-else>Unknown</span>
                <span v-if="it.quantity"> · {{ it.quantity }}</span>
              </div>
            </li>
          </ul>
          <p v-else class="muted">No items nearing expiration.</p>
        </div>
      </aside>
    </div>

    <div v-if="showForm" class="pv-modal" role="dialog" aria-modal="true" aria-label="Pantry item form">
      <div class="pv-modal__overlay" @click="showForm=false" aria-hidden="true"></div>
      <div class="pv-modal__dialog u-surface">
        <PantryItemForm
          :mode="editItem ? 'edit' : 'create'"
          :modelValue="editItem || undefined"
          :busy="isSaving"
          @submit="onSubmit"
          @cancel="() => { showForm=false; editItem=null }"
        />
      </div>
    </div>
  </section>
</template>

<style scoped>
.pv-head { display: flex; align-items: center; justify-content: space-between; gap: .5rem; }
.pv-title { font-size: 1.25rem; font-weight: 800; }
.pv-desc { color: #4b5563; }
.pv-actions { display: flex; gap: .5rem; }

.pv-grid {
  display: grid; gap: .75rem;
  grid-template-columns: 1fr;
  margin-top: .75rem;
}
@media (min-width: 1024px) {
  .pv-grid { grid-template-columns: 2fr 1fr; }
}
.pv-side .side-title { font-weight: 800; margin-bottom: .35rem; }
.soon-list { list-style: none; padding-left: 0; display: grid; gap: .4rem; }
.soon-row { display: flex; align-items: center; justify-content: space-between; }
.soon-sub { font-size: .9rem; }

.pv-modal { position: fixed; inset: 0; z-index: 50; }
.pv-modal__overlay { position: absolute; inset: 0; background: rgba(17,24,39,.45); }
.pv-modal__dialog { position: relative; width: min(720px, calc(100vw - 2rem)); margin: 2rem auto; border: 1px solid var(--hc-border); border-radius: var(--hc-radius); padding: .5rem; }
</style>
