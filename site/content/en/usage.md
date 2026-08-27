---
title: Usage
description: Client setup and basic operations
---

# Usage

Here is the simplest way to get started.

## Minimal example

```ts
import { createLocalGovClient } from "@b4moss/jp-local-gov-id";
import dataset from "@b4moss/jp-local-gov-id-data";

const client = await createLocalGovClient({ data: dataset });

client.listPrefectures();
client.getPrefectureByCode("27"); // Osaka
client.getPrefectureCodeByName("大阪府"); // "27"
await client.listMunicipalitiesByPrefecture("13"); // Tokyo municipalities, etc.
await client.listMunicipalitiesByPrefecture("01", { designatedCity: "city" }); // designated-city body only
await client.getMunicipalityByCode("131016"); // Chiyoda
await client.getByCode("131016");
await client.searchByText("中央", { prefecture: "01", target: "cities" });
await client.searchByText("ちよだ", { prefecture: "13", target: "cities" }); // kana / hiragana OK
await client.getLocalGovCodeByName("千代田区"); // "131016"
```

### Designated-city body / ward filter

For address forms that need “city only” or “wards only”, use `designatedCity` (default `"both"`).

| Value | Meaning | Example (Hokkaido) |
|-------|---------|--------------------|
| `"both"` | City body and wards | `札幌市` and `札幌市中央区` |
| `"city"` | City body only | `札幌市` only |
| `"ward"` | Wards only | `札幌市中央区`, etc. |

Applies to: `listMunicipalitiesByPrefecture` / `searchByText` / `getLocalGovCodeByName`. Tokyo special wards are not affected.

```ts
// Address select: city only
await client.listMunicipalitiesByPrefecture("01", { designatedCity: "city" });

// Address select: wards only
await client.listMunicipalitiesByPrefecture("01", { designatedCity: "ward" });

// Same option works with search
await client.searchByText("札幌", {
  prefecture: "01",
  target: "cities",
  designatedCity: "ward",
});
```

Install the app and data packages from npm, then import and use them as shown above.

## Dealing with a large dataset

You might wonder: **“Isn’t shipping nationwide data via npm huge?”**

**YES.** The v0.1.0 dataset is over 400KB.

We recommend building the app (`@b4moss/jp-local-gov-id`) and the dataset (`@b4moss/jp-local-gov-id-data`) separately with your package manager / bundler — copy the JSON as static assets and load them via `url`, instead of bundling `dataset.js` into your app.

### With Vite

```shell
npm i -D vite-plugin-static-copy
```

```ts
// vite.config.ts
import { defineConfig } from "vite";
import { viteStaticCopy } from "vite-plugin-static-copy";
export default defineConfig({
  plugins: [
    viteStaticCopy({
      targets: [
        {
          // Do not copy dataset.js (it would bloat the bundle)
          src: [
            "node_modules/@b4moss/jp-local-gov-id-data/index.json",
            "node_modules/@b4moss/jp-local-gov-id-data/prefectures.json",
            "node_modules/@b4moss/jp-local-gov-id-data/prefectures",
          ],
          dest: "jp-local-gov-id-data",
        },
      ],
    }),
  ],
  // Exclude from optimizeDeps so accidental imports are easier to notice
  optimizeDeps: {
    exclude: ["@b4moss/jp-local-gov-id-data"],
  },
});
```

```ts
// app.ts, etc.
const client = await createLocalGovClient({
  url: "/jp-local-gov-id-data/index.json",
});
```

### With Webpack

```shell
npm i -D copy-webpack-plugin
```

```js
// webpack.config.js
const path = require("path");
const CopyWebpackPlugin = require("copy-webpack-plugin");

module.exports = {
  entry: "./src/main.js",
  output: {
    path: path.resolve(__dirname, "dist"),
    filename: "app.js",
    clean: true,
  },
  plugins: [
    new CopyWebpackPlugin({
      patterns: [
        {
          from: "node_modules/@b4moss/jp-local-gov-id-data/index.json",
          to: "jp-local-gov-id-data/index.json",
        },
        {
          from: "node_modules/@b4moss/jp-local-gov-id-data/prefectures.json",
          to: "jp-local-gov-id-data/prefectures.json",
        },
        {
          from: "node_modules/@b4moss/jp-local-gov-id-data/prefectures",
          to: "jp-local-gov-id-data/prefectures",
        },
      ],
    }),
  ],
  // Avoid bundling the data package
  externals: {
    // Only if needed. Usually just don't import it.
  },
};
```

```js
// app.js, etc.
const client = await createLocalGovClient({
  url: "/jp-local-gov-id-data/index.json",
});
```

### Loading the dataset from an external URL

You may not want to self-host the dataset.

In that case, load it from an external URL.

Install only the app package — do not install the data package.

```shell
npm install @b4moss/jp-local-gov-id

# If you already installed the data package, uninstall it
# npm uninstall @b4moss/jp-local-gov-id-data
```

Then pass the `url` option when creating the client.

```ts
const client = await createLocalGovClient({
  url: "https://cdn.jsdelivr.net/npm/@b4moss/jp-local-gov-id-data@0.1.0/index.json",
});
```

This example uses a jsDelivr URL, but you can also serve a self-hosted dataset and point `url` at it.

Prefer a versioned URL. The client caches responses, so if the dataset updates under a non-unique URL, stale cache may be served.

```ts
// Disable cache
const client = await createLocalGovClient({
  url: "https://cdn.jsdelivr.net/npm/@b4moss/jp-local-gov-id-data@0.1.0/index.json",
  cache: false,
});

// TTL = 1 hour
const clientShortTtl = await createLocalGovClient({
  url: "https://cdn.jsdelivr.net/npm/@b4moss/jp-local-gov-id-data@0.1.0/index.json",
  cacheTtlSeconds: 3600,
});
```

- With `url`, fetched files are cached in localStorage by default (key = each file URL)
- Disable with `cache: false`; set TTL via `cacheTtlSeconds` (seconds; default 1 year = `31536000`)
- Exception: municipality JSON loaded by **nationwide** string search stays in memory only (to avoid cache bloat)
- Environments without localStorage (e.g. Node) skip caching
- String search normalizes hiragana / fullwidth kana to halfwidth kana (`matchField` default: `"both"`)
- Schema mismatch / invalid JSON → `LocalGovSchemaError`; network / HTTP failures → normal fetch errors
- Missing or ambiguous results → `null` / `[]` (no throw)

For loading from plain HTML without a package manager, see [Installation](/en/installation).

## Code formats

Supported code formats:

- Prefecture codes
  - 2-digit half-width digits
  - 1-digit input is accepted with or without zero-padding
    - `01` and `1` behave the same
- Local government codes
  - 6 digits including the check digit
  - Missing check digit is an error

## Dataset layout

| File | Contents |
|------|----------|
| `index.json` | Index of paths, `schemaVersion`, `asOf`, etc. |
| `prefectures.json` | Prefectures only |
| `prefectures/{code}.json` | Municipalities for that prefecture (e.g. `13.json`) |

See [API](/en/api) and [Playground](/en/playground) for more.
