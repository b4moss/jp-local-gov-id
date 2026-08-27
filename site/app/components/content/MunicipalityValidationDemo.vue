<script setup lang="ts">
import type { LocalGov } from "@b4moss/jp-local-gov-id";

const { t } = useI18n();

const ready = ref(false);
const initError = ref<string | null>(null);
const prefectures = ref<LocalGov[]>([]);
const prefectureCode = ref("");
const municipalityName = ref("");
const townAddress = ref("");
const buildingName = ref("");
const pending = ref(false);
const error = ref<string | null>(null);
const resolvedCode = ref<string | null | undefined>(undefined);

onMounted(async () => {
  try {
    const client = await useLocalGovClient();
    prefectures.value = client.listPrefectures();
    ready.value = true;
  } catch (e) {
    initError.value = e instanceof Error ? e.message : String(e);
  }
});

async function validateOnBlur() {
  error.value = null;
  resolvedCode.value = undefined;

  const name = municipalityName.value.trim();
  if (!name) return;

  if (!prefectureCode.value) {
    error.value = t("municipalityValidationDemo.needPrefecture");
    return;
  }

  pending.value = true;
  try {
    const client = await useLocalGovClient();
    const code = await client.getLocalGovCodeByName(name, {
      prefecture: prefectureCode.value,
      target: "cities",
    });
    resolvedCode.value = code;
    if (code === null) {
      error.value = t("municipalityValidationDemo.invalid");
    }
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e);
    resolvedCode.value = undefined;
  } finally {
    pending.value = false;
  }
}
</script>

<template>
  <div class="panel demo">
    <p v-if="initError" class="error-text">{{ initError }}</p>
    <p v-else-if="!ready" class="muted">
      {{ t("municipalityValidationDemo.loading") }}
    </p>
    <template v-else>
      <div class="field">
        <label for="valid-pref">
          {{ t("municipalityValidationDemo.prefecture") }}
        </label>
        <select id="valid-pref" v-model="prefectureCode">
          <option value="">
            {{ t("municipalityValidationDemo.prefecturePlaceholder") }}
          </option>
          <option
            v-for="pref in prefectures"
            :key="pref.code"
            :value="pref.code"
          >
            {{ pref.name }}
          </option>
        </select>
      </div>
      <div class="field">
        <label for="valid-muni">
          {{ t("municipalityValidationDemo.municipality") }}
        </label>
        <input
          id="valid-muni"
          v-model="municipalityName"
          type="text"
          :placeholder="t('municipalityValidationDemo.placeholder')"
          :disabled="pending"
          @blur="validateOnBlur"
        >
      </div>
      <div class="field">
        <label for="valid-town">
          {{ t("municipalityValidationDemo.townAddress") }}
        </label>
        <input
          id="valid-town"
          v-model="townAddress"
          type="text"
          :placeholder="t('municipalityValidationDemo.townAddressPlaceholder')"
        >
      </div>
      <div class="field">
        <label for="valid-building">
          {{ t("municipalityValidationDemo.buildingName") }}
        </label>
        <input
          id="valid-building"
          v-model="buildingName"
          type="text"
          :placeholder="t('municipalityValidationDemo.buildingNamePlaceholder')"
        >
      </div>
      <p v-if="error" class="error-text">{{ error }}</p>
      <p v-else-if="resolvedCode" class="ok-text">
        {{ t("municipalityValidationDemo.valid", { code: resolvedCode }) }}
      </p>
    </template>
  </div>
</template>

<style scoped>
.demo {
  margin: 1.25rem 0;
}

.ok-text {
  color: var(--color-ok, #1a7f37);
  margin: 0.75rem 0 0;
}
</style>
