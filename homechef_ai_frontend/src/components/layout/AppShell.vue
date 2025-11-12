<script setup lang="ts">
import { ref, watch } from 'vue'
import { useRoute, RouterLink } from 'vue-router'

/**
 * PUBLIC_INTERFACE
 * AppShell component: Provides the application chrome including a top NavBar,
 * optional collapsible SideBar, and a main content area using slots.
 * Props:
 *  - title: string - Brand/title shown in the NavBar
 *  - showSidebar: boolean - whether to render the sidebar container
 * Slots:
 *  - sidebar: content for the optional sidebar panel
 *  - default: main content area
 */
const props = withDefaults(defineProps<{
  title?: string
  showSidebar?: boolean
}>(), {
  title: 'HomeChef AI',
  showSidebar: true,
})

const isSidebarOpen = ref(false)
const route = useRoute()

// Close sidebar on route change for mobile UX
watch(() => route.fullPath, () => {
  isSidebarOpen.value = false
})

function toggleSidebar() {
  isSidebarOpen.value = !isSidebarOpen.value
}
</script>

<template>
  <div class="app-shell u-gradient-subtle">
    <!-- Top Navigation -->
    <header class="topnav">
      <div class="container topnav-inner">
        <button
          class="u-btn u-btn--ghost"
          aria-label="Toggle sidebar"
          @click="toggleSidebar"
          v-if="props.showSidebar"
        >
          <!-- Simple hamburger icon -->
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M4 7h16M4 12h16M4 17h16" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
          </svg>
        </button>

        <RouterLink to="/" class="brand flex-center" aria-label="Home">
          <div class="logo-dot" aria-hidden="true"></div>
          <span class="brand-text">{{ props.title }}</span>
        </RouterLink>

        <nav class="nav-links" aria-label="Primary navigation">
          <RouterLink to="/" class="nav-link" active-class="nav-link--active" exact>Home</RouterLink>
          <RouterLink to="/recipes" class="nav-link" active-class="nav-link--active">Recipes</RouterLink>
          <RouterLink to="/pantry" class="nav-link" active-class="nav-link--active">Pantry</RouterLink>
          <RouterLink to="/nutrition" class="nav-link" active-class="nav-link--active">Nutrition</RouterLink>
          <RouterLink to="/settings" class="nav-link" active-class="nav-link--active">Settings</RouterLink>
        </nav>

        <div class="nav-actions">
          <button class="u-btn u-btn--secondary">Sign in</button>
        </div>
      </div>
    </header>

    <!-- Body with optional sidebar -->
    <div class="app-body container">
      <aside
        v-if="props.showSidebar"
        class="sidebar u-surface"
        :class="{ 'is-open': isSidebarOpen }"
        aria-label="Sidebar"
      >
        <slot name="sidebar">
          <div class="sidebar-default">
            <h3 class="sidebar-title">Pantry</h3>
            <ul class="sidebar-menu">
              <li><a href="#" class="nav-link">My Pantry</a></li>
              <li><a href="#" class="nav-link">Shopping List</a></li>
              <li><a href="#" class="nav-link">Saved Recipes</a></li>
            </ul>
          </div>
        </slot>
      </aside>

      <main class="main u-card">
        <slot />
      </main>
    </div>

    <footer class="container app-footer">
      <span class="badge badge--primary">Ocean Professional</span>
      <span style="margin-left: .5rem;">© {{ new Date().getFullYear() }} HomeChef AI</span>
    </footer>
  </div>
</template>

<style scoped>
.brand {
  display: inline-flex;
  align-items: center;
  gap: .6rem;
  font-weight: 800;
  font-size: 1.125rem;
  color: var(--hc-text);
}
.brand:hover {
  text-decoration: none;
  color: var(--hc-primary);
}
.brand-text {
  letter-spacing: .2px;
}
.logo-dot {
  width: 12px;
  height: 12px;
  border-radius: 999px;
  background: radial-gradient(100% 100% at 30% 30%, #60a5fa 0%, var(--hc-primary) 60%, #1e3a8a 100%);
  box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.12);
}

.nav-links {
  margin-left: auto;
  display: none;
  align-items: center;
  gap: .25rem;
}
.nav-actions {
  display: none;
  margin-left: .5rem;
}

.flex-center {
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

/* Responsive show/hide */
@media (min-width: 768px) {
  .nav-links {
    display: inline-flex;
  }
  .nav-actions {
    display: inline-flex;
  }
}

.main {
  min-height: 60vh;
}
.sidebar-title {
  font-size: 0.95rem;
  font-weight: 700;
  color: var(--hc-text);
  margin-bottom: .5rem;
}
.sidebar-menu {
  list-style: none;
  padding-left: 0;
}
.sidebar-menu li + li {
  margin-top: .25rem;
}
</style>
