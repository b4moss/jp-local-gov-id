<script setup lang="ts">
import type { LocalGov } from "@b4moss/jp-local-gov-id";

const { t } = useI18n();

type PrefGroup = {
  prefecture: LocalGov;
  municipalities: LocalGov[];
};

type PreviewChip =
  | { kind: "pref"; code: string; label: string }
  | { kind: "muni"; code: string; label: string };

type ComboOption =
  | { kind: "pref"; code: string; label: string; detail: string }
  | { kind: "muni"; code: string; label: string; detail: string };

const ready = ref(false);
const initError = ref<string | null>(null);
const groups = ref<PrefGroup[]>([]);
const selected = ref<Set<string>>(new Set());
const openPrefs = ref<Set<string>>(new Set());

const comboQuery = ref("");
const comboOpen = ref(false);
const comboActive = ref(0);
const comboRoot = ref<HTMLElement | null>(null);

const selectedCount = computed(() => selected.value.size);

const previewChips = computed((): PreviewChip[] => {
  const chips: PreviewChip[] = [];
  for (const group of groups.value) {
    const munis = group.municipalities.filter((m) =>
      selected.value.has(m.code),
    );
    if (munis.length === 0) continue;
    if (munis.length === group.municipalities.length) {
      chips.push({
        kind: "pref",
        code: group.prefecture.code,
        label: `${group.prefecture.name}（${t("nationwideMunicipalityFilterDemo.previewAll")}）`,
      });
    } else {
      for (const muni of munis) {
        chips.push({
          kind: "muni",
          code: muni.code,
          label: muni.name,
        });
      }
    }
  }
  return chips;
});

const comboOptions = computed((): ComboOption[] => {
  const q = comboQuery.value.trim().toLowerCase();
  if (!q) return [];

  const options: ComboOption[] = [];
  for (const group of groups.value) {
    if (group.prefecture.name.toLowerCase().includes(q)) {
      options.push({
        kind: "pref",
        code: group.prefecture.code,
        label: group.prefecture.name,
        detail: t("nationwideMunicipalityFilterDemo.comboPrefDetail", {
          total: group.municipalities.length,
        }),
      });
    }
    for (const muni of group.municipalities) {
      if (
        muni.name.toLowerCase().includes(q) ||
        muni.code.includes(q)
      ) {
        options.push({
          kind: "muni",
          code: muni.code,
          label: muni.name,
          detail: `${group.prefecture.name} · ${muni.code}`,
        });
      }
      if (options.length >= 12) return options;
    }
    if (options.length >= 12) break;
  }
  return options;
});

watch(comboOptions, () => {
  comboActive.value = 0;
});

onMounted(async () => {
  document.addEventListener("pointerdown", onDocPointerDown);

  try {
    const client = await useLocalGovClient();
    const prefectures = [...client.listPrefectures()].sort((a, b) =>
      a.code.localeCompare(b.code),
    );

    const loaded: PrefGroup[] = [];
    const batchSize = 6;
    for (let i = 0; i < prefectures.length; i += batchSize) {
      const batch = prefectures.slice(i, i + batchSize);
      const results = await Promise.all(
        batch.map(async (prefecture) => {
          const municipalities = [
            ...(await client.listMunicipalitiesByPrefecture(prefecture.code)),
          ].sort((a, b) => a.code.localeCompare(b.code));
          return { prefecture, municipalities };
        }),
      );
      loaded.push(...results);
    }

    groups.value = loaded;
    if (loaded[0]) openPrefs.value = new Set([loaded[0].prefecture.code]);
    ready.value = true;
  } catch (e) {
    initError.value = e instanceof Error ? e.message : String(e);
  }
});

function isOpen(prefCode: string) {
  return openPrefs.value.has(prefCode);
}

function toggleOpen(prefCode: string) {
  const next = new Set(openPrefs.value);
  if (next.has(prefCode)) next.delete(prefCode);
  else next.add(prefCode);
  openPrefs.value = next;
}

function openPref(prefCode: string) {
  const next = new Set(openPrefs.value);
  next.add(prefCode);
  openPrefs.value = next;
}

function isChecked(code: string) {
  return selected.value.has(code);
}

function toggleMunicipality(code: string, checked: boolean) {
  const next = new Set(selected.value);
  if (checked) next.add(code);
  else next.delete(code);
  selected.value = next;
}

function selectedInPref(group: PrefGroup) {
  return group.municipalities.filter((m) => selected.value.has(m.code)).length;
}

function allSelectedInPref(group: PrefGroup) {
  return (
    group.municipalities.length > 0 &&
    group.municipalities.every((m) => selected.value.has(m.code))
  );
}

function someSelectedInPref(group: PrefGroup) {
  const n = selectedInPref(group);
  return n > 0 && n < group.municipalities.length;
}

function togglePrefAll(group: PrefGroup, checked: boolean) {
  const next = new Set(selected.value);
  for (const m of group.municipalities) {
    if (checked) next.add(m.code);
    else next.delete(m.code);
  }
  selected.value = next;
}

function clearPrefSelection(prefCode: string) {
  const group = groups.value.find((g) => g.prefecture.code === prefCode);
  if (group) togglePrefAll(group, false);
}

function removeChip(chip: PreviewChip) {
  if (chip.kind === "pref") clearPrefSelection(chip.code);
  else toggleMunicipality(chip.code, false);
}

function clearSelection() {
  selected.value = new Set();
}

function onPrefAllChange(group: PrefGroup, event: Event) {
  const input = event.target as HTMLInputElement;
  togglePrefAll(group, input.checked);
}

function onMuniChange(code: string, event: Event) {
  const input = event.target as HTMLInputElement;
  toggleMunicipality(code, input.checked);
}

function pickComboOption(option: ComboOption) {
  if (option.kind === "pref") {
    const group = groups.value.find((g) => g.prefecture.code === option.code);
    if (group) togglePrefAll(group, true);
    openPref(option.code);
  } else {
    toggleMunicipality(option.code, true);
    const group = groups.value.find((g) =>
      g.municipalities.some((m) => m.code === option.code),
    );
    if (group) openPref(group.prefecture.code);
  }
  comboQuery.value = "";
  comboOpen.value = false;
}

function onComboInput() {
  comboOpen.value = comboQuery.value.trim().length > 0;
}

function onComboKeydown(event: KeyboardEvent) {
  const options = comboOptions.value;
  if (!comboOpen.value || options.length === 0) {
    if (event.key === "Escape") comboOpen.value = false;
    return;
  }

  if (event.key === "ArrowDown") {
    event.preventDefault();
    comboActive.value = (comboActive.value + 1) % options.length;
  } else if (event.key === "ArrowUp") {
    event.preventDefault();
    comboActive.value =
      (comboActive.value - 1 + options.length) % options.length;
  } else if (event.key === "Enter") {
    event.preventDefault();
    const option = options[comboActive.value];
    if (option) pickComboOption(option);
  } else if (event.key === "Escape") {
    comboOpen.value = false;
  }
}

function onDocPointerDown(event: PointerEvent) {
  const root = comboRoot.value;
  if (!root) return;
  if (event.target instanceof Node && !root.contains(event.target)) {
    comboOpen.value = false;
  }
}

onBeforeUnmount(() => {
  document.removeEventListener("pointerdown", onDocPointerDown);
});
</script>

<template>
  <div class="panel demo filter-demo">
    <p v-if="initError" class="error-text">{{ initError }}</p>
    <p v-else-if="!ready" class="muted">
      {{ t("nationwideMunicipalityFilterDemo.loading") }}
    </p>
    <template v-else>
      <header class="filter-header">
        <div class="filter-toolbar">
          <div class="filter-toolbar__title">
            {{ t("nationwideMunicipalityFilterDemo.title") }}
          </div>
          <div class="filter-toolbar__meta">
            <span class="filter-count">
              {{
                t("nationwideMunicipalityFilterDemo.selectedCount", {
                  count: selectedCount,
                })
              }}
            </span>
            <button
              type="button"
              class="filter-clear"
              :disabled="selectedCount === 0"
              @click="clearSelection"
            >
              {{ t("nationwideMunicipalityFilterDemo.clear") }}
            </button>
          </div>
        </div>

        <div ref="comboRoot" class="filter-combo">
          <label class="sr-only" for="area-combo">
            {{ t("nationwideMunicipalityFilterDemo.comboLabel") }}
          </label>
          <input
            id="area-combo"
            v-model="comboQuery"
            type="text"
            role="combobox"
            class="filter-combo__input"
            autocomplete="off"
            :aria-expanded="comboOpen && comboOptions.length > 0"
            aria-controls="area-combo-list"
            aria-autocomplete="list"
            :placeholder="t('nationwideMunicipalityFilterDemo.comboPlaceholder')"
            @input="onComboInput"
            @focus="onComboInput"
            @keydown="onComboKeydown"
          >
          <ul
            v-show="comboOpen && comboOptions.length > 0"
            id="area-combo-list"
            class="filter-combo__list"
            role="listbox"
          >
            <li
              v-for="(option, index) in comboOptions"
              :key="`${option.kind}-${option.code}`"
              role="option"
              class="filter-combo__option"
              :aria-selected="index === comboActive"
              :data-active="index === comboActive"
              @mousedown.prevent="pickComboOption(option)"
            >
              <span class="filter-combo__option-label">{{ option.label }}</span>
              <span class="filter-combo__option-detail">{{ option.detail }}</span>
            </li>
          </ul>
          <p
            v-if="comboOpen && comboQuery.trim() && comboOptions.length === 0"
            class="filter-combo__empty muted"
          >
            {{ t("nationwideMunicipalityFilterDemo.comboEmpty") }}
          </p>
        </div>

        <div class="filter-preview" aria-live="polite">
          <span class="filter-preview__label">
            {{ t("nationwideMunicipalityFilterDemo.previewLabel") }}
          </span>
          <div class="filter-preview__chips">
            <span
              v-if="previewChips.length === 0"
              class="filter-preview__empty muted"
            >
              {{ t("nationwideMunicipalityFilterDemo.previewEmpty") }}
            </span>
            <button
              v-for="chip in previewChips"
              :key="`${chip.kind}-${chip.code}`"
              type="button"
              class="preview-chip"
              :class="{ 'preview-chip--pref': chip.kind === 'pref' }"
              :aria-label="
                chip.kind === 'pref'
                  ? t('nationwideMunicipalityFilterDemo.removePref', {
                      name: chip.label,
                    })
                  : t('nationwideMunicipalityFilterDemo.removeMuni', {
                      name: chip.label,
                    })
              "
              @click="removeChip(chip)"
            >
              <span>{{ chip.label }}</span>
              <span class="preview-chip__x" aria-hidden="true">×</span>
            </button>
          </div>
        </div>
      </header>

      <div class="filter-list" role="list">
        <section
          v-for="group in groups"
          :key="group.prefecture.code"
          class="pref-block"
          role="listitem"
        >
          <div class="pref-header">
            <label class="pref-all">
              <input
                type="checkbox"
                :checked="allSelectedInPref(group)"
                :ref="
                  (el) => {
                    if (el && 'indeterminate' in el) {
                      (el as HTMLInputElement).indeterminate =
                        someSelectedInPref(group);
                    }
                  }
                "
                @change="onPrefAllChange(group, $event)"
              >
              <span class="pref-name">{{ group.prefecture.name }}</span>
              <span class="pref-meta">
                {{
                  t("nationwideMunicipalityFilterDemo.prefMeta", {
                    selected: selectedInPref(group),
                    total: group.municipalities.length,
                  })
                }}
              </span>
            </label>
            <button
              type="button"
              class="pref-toggle"
              :aria-expanded="isOpen(group.prefecture.code)"
              @click="toggleOpen(group.prefecture.code)"
            >
              {{
                isOpen(group.prefecture.code)
                  ? t("nationwideMunicipalityFilterDemo.collapse")
                  : t("nationwideMunicipalityFilterDemo.expand")
              }}
            </button>
          </div>

          <div
            v-show="isOpen(group.prefecture.code)"
            class="muni-grid"
          >
            <label
              v-for="muni in group.municipalities"
              :key="muni.code"
              class="muni-item"
            >
              <input
                type="checkbox"
                :checked="isChecked(muni.code)"
                @change="onMuniChange(muni.code, $event)"
              >
              <span class="muni-name">{{ muni.name }}</span>
              <span class="muni-code">{{ muni.code }}</span>
            </label>
          </div>
        </section>
      </div>
    </template>
  </div>
</template>

<style scoped>
.filter-demo {
  display: flex;
  flex-direction: column;
  height: 100%;
  max-height: calc(2.65rem + 28rem);
  min-height: 0;
  padding: 0;
  overflow: hidden;
}

@media (min-width: 900px) {
  .filter-demo {
    max-height: 100%;
  }
}

.filter-header {
  flex-shrink: 0;
  border-top: 1px solid var(--color-border);
  border-bottom: 1px solid var(--color-border);
  background: color-mix(in srgb, var(--color-surface) 88%, var(--color-bg));
}

.filter-toolbar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem 1rem;
  padding: 0.7rem 1rem 0.45rem;
}

.filter-toolbar__title {
  font-size: 0.95rem;
  font-weight: 700;
  letter-spacing: -0.01em;
}

.filter-toolbar__meta {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.filter-count {
  font-size: 0.8125rem;
  font-weight: 600;
  color: var(--color-accent);
}

.filter-clear {
  font: inherit;
  font-size: 0.8125rem;
  font-weight: 600;
  padding: 0.3rem 0.65rem;
  border: 1px solid var(--color-border);
  border-radius: 0.35rem;
  background: transparent;
  color: var(--color-muted);
  cursor: pointer;
}

.filter-clear:hover:not(:disabled) {
  color: var(--color-ink);
  border-color: var(--color-accent);
  background: var(--color-accent-soft);
}

.filter-clear:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

.filter-combo {
  position: relative;
  padding: 0 1rem 0.55rem;
}

.filter-combo__input {
  width: 100%;
  font: inherit;
  font-size: 0.875rem;
  padding: 0.5rem 0.7rem;
  border: 1px solid var(--color-border);
  border-radius: 0.4rem;
  background: var(--color-surface);
  color: var(--color-ink);
}

.filter-combo__input:focus {
  outline: 2px solid color-mix(in srgb, var(--color-accent) 35%, transparent);
  border-color: var(--color-accent);
}

.filter-combo__list {
  position: absolute;
  z-index: 5;
  left: 1rem;
  right: 1rem;
  top: calc(100% - 0.35rem);
  margin: 0;
  padding: 0.3rem;
  list-style: none;
  max-height: 14rem;
  overflow: auto;
  border: 1px solid var(--color-border);
  border-radius: 0.45rem;
  background: var(--color-surface);
  box-shadow: 0 0.5rem 1.25rem color-mix(in srgb, var(--color-ink) 12%, transparent);
}

.filter-combo__option {
  display: flex;
  flex-direction: column;
  gap: 0.1rem;
  padding: 0.45rem 0.55rem;
  border-radius: 0.3rem;
  cursor: pointer;
}

.filter-combo__option[data-active="true"],
.filter-combo__option:hover {
  background: var(--color-accent-soft);
}

.filter-combo__option-label {
  font-size: 0.875rem;
  font-weight: 600;
}

.filter-combo__option-detail {
  font-size: 0.72rem;
  color: var(--color-muted);
}

.filter-combo__empty {
  margin: 0.35rem 0 0;
  font-size: 0.8125rem;
}

.filter-preview {
  display: flex;
  align-items: center;
  gap: 0.55rem;
  height: 2.1rem;
  padding: 0 1rem 0.7rem;
  min-width: 0;
  box-sizing: content-box;
}

.filter-preview__label {
  flex-shrink: 0;
  font-size: 0.72rem;
  font-weight: 700;
  color: var(--color-muted);
  white-space: nowrap;
}

.filter-preview__chips {
  display: flex;
  align-items: center;
  gap: 0.35rem;
  height: 100%;
  min-width: 0;
  overflow-x: auto;
  overflow-y: hidden;
}

.filter-preview__empty {
  font-size: 0.75rem;
  white-space: nowrap;
}

.preview-chip {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  flex-shrink: 0;
  font: inherit;
  font-size: 0.72rem;
  font-weight: 600;
  padding: 0.2rem 0.4rem 0.2rem 0.5rem;
  border: 1px solid color-mix(in srgb, var(--color-accent) 35%, var(--color-border));
  border-radius: 999px;
  background: var(--color-surface);
  color: var(--color-ink);
  cursor: pointer;
  white-space: nowrap;
}

.preview-chip:hover {
  border-color: var(--color-accent);
  background: var(--color-accent-soft);
}

.preview-chip--pref {
  color: var(--color-accent);
}

.preview-chip__x {
  font-size: 0.9rem;
  line-height: 1;
  color: var(--color-muted);
}

.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}

.filter-list {
  flex: 1;
  min-height: 0;
  overflow-x: hidden;
  overflow-y: scroll;
  padding: 0 0 0.75rem;
}

.pref-block + .pref-block {
  border-top: 1px solid var(--color-border);
}

.pref-header {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.55rem 1rem;
  position: sticky;
  top: 0;
  z-index: 1;
  background: var(--color-surface);
  border-bottom: 1px solid var(--color-border);
  box-shadow: 0 1px 0 var(--color-surface);
}

.pref-all {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex: 1;
  min-width: 0;
  cursor: pointer;
}

.pref-name {
  font-weight: 700;
  font-size: 0.9rem;
}

.pref-meta {
  font-size: 0.75rem;
  color: var(--color-muted);
  white-space: nowrap;
}

.pref-toggle {
  font: inherit;
  font-size: 0.75rem;
  font-weight: 600;
  padding: 0.25rem 0.55rem;
  border: 1px solid var(--color-border);
  border-radius: 999px;
  background: transparent;
  color: var(--color-muted);
  cursor: pointer;
  flex-shrink: 0;
}

.pref-toggle:hover {
  color: var(--color-accent);
  border-color: var(--color-accent);
}

.muni-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(10.5rem, 1fr));
  gap: 0.15rem 0.35rem;
  padding: 0.15rem 1rem 0.85rem;
}

.muni-item {
  display: flex;
  align-items: baseline;
  gap: 0.4rem;
  padding: 0.35rem 0.3rem;
  border-radius: 0.3rem;
  cursor: pointer;
  font-size: 0.8125rem;
  line-height: 1.3;
}

.muni-item:hover {
  background: var(--color-accent-soft);
}

.muni-name {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.muni-code {
  margin-left: auto;
  font-family: var(--font-mono);
  font-size: 0.68rem;
  color: var(--color-muted);
  flex-shrink: 0;
}

.pref-all input,
.muni-item input {
  flex-shrink: 0;
  accent-color: var(--color-accent);
}

.filter-demo > .muted,
.filter-demo > .error-text {
  margin: 1rem 1.15rem;
}
</style>
