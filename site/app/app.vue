<script setup lang="ts">
const { t } = useI18n();

useHead({
  titleTemplate: (title) => {
    const brand = t("brand");
    return title
      ? `${title} :: ${brand} by Bicycle for Mind LLC`
      : `${brand} by Bicycle for Mind LLC`;
  },
});
</script>

<template>
  <NuxtLayout>
    <NuxtPage />
  </NuxtLayout>
</template>
