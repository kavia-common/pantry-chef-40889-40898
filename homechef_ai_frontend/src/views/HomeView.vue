<script setup lang="ts">
import TheWelcome from '../components/TheWelcome.vue'
</script>

<template>
  <section class="home-content">
    <div class="u-card">
      <h2 style="font-size:1.25rem; font-weight:800; margin-bottom:.5rem;">Welcome to HomeChef AI</h2>
      <p style="color:#4b5563; margin-bottom:1rem;">Start by adding ingredients or exploring suggested recipes.</p>
      <div style="display:flex; gap:.5rem; flex-wrap:wrap;">
        <button class="u-btn u-btn--primary">Add Ingredients</button>
        <button class="u-btn u-btn--ghost">Generate Recipes</button>
      </div>
    </div>
    <div style="height:1rem;"></div>
    <TheWelcome />
  </section>
</template>

<style scoped>
.home-content {
  display: grid;
  gap: 1rem;
}
</style>
