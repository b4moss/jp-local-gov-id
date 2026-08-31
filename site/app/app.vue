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

/** html lang/dir plus canonical and hreflang alternates for every route. */
const localeHead = useLocaleHead({ dir: true, lang: true, seo: true });

useHead(() => ({
  htmlAttrs: localeHead.value.htmlAttrs,
  link: localeHead.value.link,
  meta: localeHead.value.meta,
}));
</script>

<template>
  <NuxtLayout>
    <NuxtPage />
  </NuxtLayout>
</template>
