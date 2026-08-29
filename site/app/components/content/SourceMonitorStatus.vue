<script setup lang="ts">
type MonitorStatus = "ok" | "fetch_failed" | "hash_mismatch";

type SourceMonitorResult = {
  sourceUrl: string;
  localPath: string;
  checkedAt: string;
  expectedSha256: string;
  remoteSha256: string | null;
  status: MonitorStatus;
  error?: string;
};

const STATUS_URL_RAW =
  "https://raw.githubusercontent.com/b4moss/jp-local-gov-id/main/site/public/source-monitor.json";
const STATUS_URL_LOCAL = "/source-monitor.json";

const { locale } = useI18n();

const loading = ref(true);
const loadError = ref(false);
const result = ref<SourceMonitorResult | null>(null);

async function loadStatus(): Promise<SourceMonitorResult> {
  // Prefer raw main for freshness between site-v deploys; fall back to same-origin copy.
  for (const url of [STATUS_URL_RAW, STATUS_URL_LOCAL]) {
    try {
      const res = await fetch(url, { cache: "no-store" });
      if (!res.ok) continue;
      return (await res.json()) as SourceMonitorResult;
    } catch {
      // try next
    }
  }
  throw new Error("status fetch failed");
}

const messages = computed(() => {
  const ja = locale.value === "ja";
  return {
    loading: ja ? "読み込み中…" : "Loading…",
    loadFailed: ja
      ? "ステータス取得不可（ネットワークまたは JSON 取得に失敗）"
      : "Could not load status (network or JSON fetch failed)",
    ok: ja ? "問題なし" : "OK",
    fetchFailed: ja ? "取得失敗・詳細調査中" : "Fetch failed — under investigation",
    hashMismatch: ja
      ? "ハッシュ差分検知・詳細調査中"
      : "Hash mismatch — under investigation",
    lastChecked: ja ? "最終確認" : "Last checked",
    expected: ja ? "期待ハッシュ" : "Expected hash",
    remote: ja ? "リモートハッシュ" : "Remote hash",
    source: ja ? "監視 URL" : "Source URL",
  };
});

const statusLabel = computed(() => {
  const s = result.value?.status;
  if (s === "ok") return messages.value.ok;
  if (s === "fetch_failed") return messages.value.fetchFailed;
  if (s === "hash_mismatch") return messages.value.hashMismatch;
  return "";
});

function shortHash(hex: string | null | undefined): string {
  if (!hex) return "—";
  return `${hex.slice(0, 12)}…${hex.slice(-8)}`;
}

function formatCheckedAt(iso: string): string {
  try {
    return new Date(iso).toISOString().replace("T", " ").replace(/\.\d{3}Z$/, " UTC");
  } catch {
    return iso;
  }
}

onMounted(async () => {
  try {
    result.value = await loadStatus();
  } catch {
    loadError.value = true;
  } finally {
    loading.value = false;
  }
});
</script>

<template>
  <div class="source-monitor" :data-status="result?.status ?? (loadError ? 'load_error' : 'loading')">
    <p v-if="loading" class="source-monitor__line">{{ messages.loading }}</p>
    <p v-else-if="loadError" class="source-monitor__line source-monitor__line--warn">
      {{ messages.loadFailed }}
    </p>
    <template v-else-if="result">
      <p class="source-monitor__status">{{ statusLabel }}</p>
      <ul class="source-monitor__meta">
        <li>
          <span class="source-monitor__key">{{ messages.lastChecked }}</span>
          <span>{{ formatCheckedAt(result.checkedAt) }}</span>
        </li>
        <li>
          <span class="source-monitor__key">{{ messages.expected }}</span>
          <code :title="result.expectedSha256">{{ shortHash(result.expectedSha256) }}</code>
        </li>
        <li>
          <span class="source-monitor__key">{{ messages.remote }}</span>
          <code :title="result.remoteSha256 ?? ''">{{ shortHash(result.remoteSha256) }}</code>
        </li>
        <li>
          <span class="source-monitor__key">{{ messages.source }}</span>
          <a :href="result.sourceUrl" rel="noopener noreferrer" target="_blank">{{
            result.sourceUrl
          }}</a>
        </li>
      </ul>
    </template>
  </div>
</template>

<style scoped>
.source-monitor {
  margin: 1rem 0 1.5rem;
  padding: 0.85rem 1rem;
  border-left: 3px solid var(--color-border);
  background: var(--color-accent-soft, transparent);
}

.source-monitor[data-status="ok"] {
  border-left-color: var(--color-accent, #2a6f4e);
}

.source-monitor[data-status="fetch_failed"],
.source-monitor[data-status="hash_mismatch"],
.source-monitor[data-status="load_error"] {
  border-left-color: #a65d3f;
}

.source-monitor__status {
  margin: 0 0 0.5rem;
  font-weight: 600;
}

.source-monitor__line {
  margin: 0;
}

.source-monitor__line--warn {
  color: #a65d3f;
}

.source-monitor__meta {
  margin: 0;
  padding: 0;
  list-style: none;
  font-size: 0.9rem;
  line-height: 1.55;
}

.source-monitor__meta li {
  display: grid;
  grid-template-columns: 8.5rem 1fr;
  gap: 0.5rem;
  margin: 0.15rem 0;
}

.source-monitor__key {
  color: var(--color-muted, #666);
}

.source-monitor code {
  font-size: 0.85em;
  word-break: break-all;
}

.source-monitor a {
  word-break: break-all;
}

@media (max-width: 640px) {
  .source-monitor__meta li {
    grid-template-columns: 1fr;
    gap: 0.1rem;
  }
}
</style>
