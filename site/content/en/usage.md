---
title: Usage
description: Initialize the client and call basic APIs
schemaRole: HowTo
---

# Usage

## Simplest example

```ts
import { createLocalGovClient } from "@b4moss/jp-local-gov-id";
import dataset from "@b4moss/jp-local-gov-id-data";

const client = await createLocalGovClient({ data: dataset });

client.listPrefectures();
client.getPrefectureByCode("27"); // Osaka
client.getPrefectureCodeByName("大阪府"); // "27"
client.getMunicipalityCountByPrefecture("01"); // sync; no municipality load
await client.listMunicipalitiesByPrefecture("13");
await client.getMunicipalityByCode("131016"); // Chiyoda
await client.searchByText("中央", { prefecture: "01", target: "cities" });
await client.getLocalGovCodeByName("千代田区"); // "131016"
```

### Designated-city filter

| Value | Meaning |
|-------|---------|
| `"both"` | City body and wards (default) |
| `"city"` | City body only |
| `"ward"` | Wards only |

Applies to `listMunicipalitiesByPrefecture` / `searchByText` / `getLocalGovCodeByName` / `getMunicipalityCountByPrefecture`. Tokyo special wards are unaffected.

## Is the data huge? — Split + Brotli + index

This is **not** the old multi-hundred-KB JSON dump.

- npm ships **`.bin.br` (Brotli) only**, split by prefecture plus search-index shards
- Init loads `index.json` + prefectures only (~1 KB Brotli for prefectures)
- Nationwide search uses a hybrid JLIX index, then loads **only candidate prefectures**
- Avoid bundling `dataset.js` into SPAs — prefer **`url` + static copy**

### Vite

```ts
import { defineConfig } from "vite";
import { viteStaticCopy } from "vite-plugin-static-copy";
export default defineConfig({
  plugins: [
    viteStaticCopy({
      targets: [
        {
          src: [
            "node_modules/@b4moss/jp-local-gov-id-data/index.json",
            "node_modules/@b4moss/jp-local-gov-id-data/prefectures.bin.br",
            "node_modules/@b4moss/jp-local-gov-id-data/prefectures",
            "node_modules/@b4moss/jp-local-gov-id-data/search-ngrams",
          ],
          dest: "jp-local-gov-id-data",
        },
      ],
    }),
  ],
  optimizeDeps: { exclude: ["@b4moss/jp-local-gov-id-data"] },
});
```

```ts
const client = await createLocalGovClient({
  url: "/jp-local-gov-id-data/index.json",
});
```

### CDN / self-host

```ts
const client = await createLocalGovClient({
  url: "https://cdn.jsdelivr.net/npm/@b4moss/jp-local-gov-id-data@1.0.0-rc.11/index.json",
});
```

Use a **versioned** URL (cache keys are URLs).

- `url` mode caches decoded objects in localStorage (minified JSON) — **separate from on-wire `.bin.br`**
- Nationwide search municipality loads and JLIX stay **memory-only**
- After normalize: length &lt; 2 → empty; length 2 → hot 2-gram only; length ≥ 3 → merge 2-gram + 3-gram

## Data layout

| File | Contents |
|------|----------|
| `index.json` | Paths, `schemaVersion`, `asOf`, … |
| `prefectures.bin.br` | Prefectures only |
| `prefectures/{code}.bin.br` | Municipalities for that prefecture |
| `search-ngrams/2gram/{region}.bin.br` | Hot-set 2-gram index (regional) |
| `search-ngrams/3gram/{shard}.bin.br` | Cold-set 3-gram index (3 shards) |

See [API](/en/api) and [Playground](/en/playground) for more.
