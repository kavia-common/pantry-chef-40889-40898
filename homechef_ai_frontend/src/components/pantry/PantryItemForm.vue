<script setup lang="ts">
import { reactive, ref, watch } from 'vue'
import type { PantryItem } from '@/stores/pantry'

/**
 * PUBLIC_INTERFACE
 * PantryItemForm
 * A compact form to add or edit a pantry item.
 *
 * Props:
 *  - modelValue?: PantryItem | Partial<PantryItem> used as initial values for editing
 *  - mode?: 'create' | 'edit'
 *  - busy?: boolean show busy state
 *
 * Emits:
 *  - submit(payload: { name: string; quantity?: string; expiresAt?: string })
 *  - cancel()
 */
const props = withDefaults(defineProps<{
  modelValue?: Partial<PantryItem> | null
  mode?: 'create' | 'edit'
  busy?: boolean
}>(), {
  modelValue: null,
  mode: 'create',
  busy: false,
})

const emit = defineEmits<{
  // PUBLIC_INTERFACE
  (e: 'submit', value: { name: string; quantity?: string; expiresAt?: string }): void
  (e: 'cancel'): void
}>()

const form = reactive<{ name: string; quantity: string; expiresAt: string }>({
  name: '',
  quantity: '',
  expiresAt: '',
})

watch(() => props.modelValue, (v) => {
  form.name = (v?.name ?? '').toString()
  form.quantity = (v?.quantity ?? '').toString()
  form.expiresAt = (v?.expiresAt ?? '').toString()
}, { immediate: true })

const nameError = ref<string>('')

function validate(): boolean {
  nameError.value = ''
  if (!form.name.trim()) {
    nameError.value = 'Name is required'
  }
  if (form.expiresAt) {
    const t = Date.parse(form.expiresAt)
    if (Number.isNaN(t)) {
      nameError.value = nameError.value || 'Expiration date is invalid'
      // keep both errors possible; for simplicity only one field error shown
    }
  }
  return !nameError.value
}

function onSubmit(e: Event) {
  e.preventDefault()
  if (!validate()) return
  emit('submit', {
    name: form.name.trim(),
    quantity: form.quantity.trim() || undefined,
    expiresAt: form.expiresAt ? new Date(form.expiresAt).toISOString() : undefined,
  })
}
</script>

<template>
  <form class="pform u-card" @submit="onSubmit" aria-labelledby="pform-title">
    <h3 id="pform-title" class="pform__title">
      {{ mode === 'edit' ? 'Edit Item' : 'Add Item' }}
    </h3>
    <div class="grid">
      <label class="field">
        <span class="label">Name</span>
        <input
          class="input"
          type="text"
          v-model="form.name"
          aria-required="true"
          aria-invalid="false"
          placeholder="e.g., Milk"
          required
        />
      </label>

      <label class="field">
        <span class="label">Quantity</span>
        <input
          class="input"
          type="text"
          v-model="form.quantity"
          placeholder="e.g., 1L or 2 packs"
        />
      </label>

      <label class="field">
        <span class="label">Expiration</span>
        <input
          class="input"
          type="date"
          v-model="form.expiresAt"
          :max="'9999-12-31'"
        />
      </label>
    </div>

    <p v-if="nameError" class="error" role="alert">{{ nameError }}</p>

    <div class="actions">
      <button
        class="u-btn u-btn--primary"
        type="submit"
        :disabled="busy"
        aria-label="Save pantry item"
      >
        {{ busy ? 'Saving…' : (mode === 'edit' ? 'Save Changes' : 'Add') }}
      </button>
      <button class="u-btn u-btn--ghost" type="button" @click="emit('cancel')">Cancel</button>
    </div>
  </form>
</template>

<style scoped>
.pform { display: grid; gap: .5rem; }
.pform__title { font-weight: 800; }
.grid {
  display: grid; gap: .5rem;
  grid-template-columns: repeat(1, minmax(0,1fr));
}
@media (min-width: 640px) {
  .grid { grid-template-columns: repeat(3, minmax(0,1fr)); }
}
.field { display: grid; gap: .25rem; }
.label { font-size: .85rem; color: #374151; font-weight: 600; }
.input {
  padding: .45rem .6rem; border-radius: var(--hc-radius-sm);
  border: 1px solid var(--hc-border); outline: none;
}
.input:focus-visible { box-shadow: 0 0 0 3px var(--hc-ring); }
.actions { display: flex; gap: .5rem; flex-wrap: wrap; }
.error { color: var(--hc-error); }
</style>
