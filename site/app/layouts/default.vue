<script setup lang="ts">
const route = useRoute();

const isWide = computed(() => {
  const path = route.path.replace(/\/+$/, "");
  return /\/examples\//.test(path);
});
</script>

<template>
  <div class="site-shell">
    <SiteHeader />
    <div class="site-body">
      <DocsSidebar />
      <div class="site-content">
        <main class="site-main" :class="{ 'site-main--wide': isWide }">
          <slot />
        </main>
        <SiteFooter />
      </div>
    </div>
  </div>
</template>
