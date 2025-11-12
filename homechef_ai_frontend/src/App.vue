<script setup lang="ts">
import { RouterView } from 'vue-router'
import AppShell from './components/layout/AppShell.vue'
</script>

<template>
  <AppShell title="HomeChef AI" :showSidebar="true">
    <template #sidebar>
      <!-- Default sidebar content can be customized per-page -->
      <div class="u-surface" style="padding: .5rem; border-radius: var(--hc-radius);">
        <h3 style="font-size:.95rem; font-weight:700; margin-bottom:.5rem;">Quick Actions</h3>
        <div style="display:flex; gap:.5rem; flex-wrap:wrap;">
          <button class="u-btn u-btn--primary">Add Ingredients</button>
          <button class="u-btn u-btn--ghost">Scan Receipt</button>
        </div>
      </div>
      <div style="height: .75rem;"></div>
      <div class="u-card">
        <h4 style="font-weight:700; margin-bottom:.5rem;">Tips</h4>
        <p style="color:#6b7280; font-size:.9rem;">Try voice input to add items hands-free.</p>
      </div>
    </template>

    <RouterView />
  </AppShell>
</template>

<style scoped>
/* App-centric overrides (minimal) */
</style>
