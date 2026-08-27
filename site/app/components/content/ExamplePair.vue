<script setup lang="ts">
const { t } = useI18n();

type CodeTab = "html" | "ts";
const active = ref<CodeTab>("html");

const tabs: { id: CodeTab; labelKey: string }[] = [
  { id: "html", labelKey: "codeTabs.html" },
  { id: "ts", labelKey: "codeTabs.ts" },
];
</script>

<template>
  <div class="example-pair">
    <div class="example-pair__demo">
      <slot name="demo" />
    </div>
    <div class="example-pair__code panel">
      <div class="code-tabs" role="tablist" :aria-label="t('codeTabs.label')">
        <button
          v-for="tab in tabs"
          :id="`code-tab-${tab.id}`"
          :key="tab.id"
          type="button"
          class="code-tabs__tab"
          role="tab"
          :aria-selected="active === tab.id"
          :tabindex="active === tab.id ? 0 : -1"
          @click="active = tab.id"
        >
          {{ t(tab.labelKey) }}
        </button>
      </div>
      <div
        class="code-tabs__panel"
        role="tabpanel"
        :aria-labelledby="`code-tab-${active}`"
      >
        <div v-show="active === 'html'">
          <slot name="html" />
        </div>
        <div v-show="active === 'ts'">
          <slot name="ts" />
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.example-pair {
  --example-pair-tabs: 2.65rem;
  --example-pair-body: 28rem;
  display: grid;
  gap: 1.25rem;
  margin: 1.5rem 0 2rem;
  align-items: start;
}

@media (min-width: 900px) {
  .example-pair {
    --example-pair-body: 32rem;
    grid-template-columns: minmax(0, 1fr) minmax(0, 1.15fr);
    gap: 1.5rem;
    align-items: stretch;
    height: calc(var(--example-pair-tabs) + var(--example-pair-body));
  }

  .example-pair__demo {
    display: flex;
    flex-direction: column;
    min-height: 0;
    height: 100%;
    overflow: hidden;
  }

  .example-pair__demo > :deep(*) {
    flex: 1;
    display: flex;
    flex-direction: column;
    min-height: 0;
    height: 100%;
    max-height: 100%;
  }

  .example-pair__demo :deep(.panel.demo) {
    flex: 1;
    width: 100%;
    height: 100%;
    max-height: 100%;
    min-height: 0;
    margin: 0;
    box-sizing: border-box;
    overflow: hidden;
  }
}

.example-pair__demo :deep(.demo) {
  margin: 0;
}

.example-pair__code {
  min-width: 0;
  height: 100%;
  max-height: calc(var(--example-pair-tabs) + var(--example-pair-body));
  padding: 0;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.code-tabs {
  display: flex;
  flex-shrink: 0;
  gap: 0;
  height: var(--example-pair-tabs);
  box-sizing: border-box;
  border-bottom: 1px solid var(--color-border);
  background: color-mix(in srgb, var(--color-surface) 88%, var(--color-bg));
}

.code-tabs__tab {
  font: inherit;
  font-size: 0.8125rem;
  font-weight: 600;
  letter-spacing: 0.02em;
  padding: 0 1rem;
  border: none;
  border-bottom: 2px solid transparent;
  margin-bottom: -1px;
  background: transparent;
  color: var(--color-muted);
  cursor: pointer;
}

.code-tabs__tab:hover {
  color: var(--color-ink);
}

.code-tabs__tab[aria-selected="true"] {
  color: var(--color-accent);
  border-bottom-color: var(--color-accent);
}

.code-tabs__panel {
  min-width: 0;
  height: var(--example-pair-body);
  flex-shrink: 0;
  overflow: auto;
  background: #0d1117;
}

.example-pair__code :deep(pre) {
  margin: 0;
  border-radius: 0;
  min-height: 100%;
  background: #0d1117;
}
</style>
