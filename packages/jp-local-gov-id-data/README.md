# @b4moss/jp-local-gov-id-data

[日本語](./README_ja.md)

Brotli-compressed binary (`.bin.br`) datasets of Japan’s nationwide local government codes (全国地方公共団体コード).

This package ships **data only**. For search and lookup APIs, use [`@b4moss/jp-local-gov-id`](https://www.npmjs.com/package/@b4moss/jp-local-gov-id) with this package, or serve the same files yourself behind a versioned index URL.

## Install

```bash
npm install @b4moss/jp-local-gov-id-data
```

## What’s included

| Path | Contents |
|------|----------|
| `index.json` | Index metadata (`schemaVersion`, `asOf`, paths, counts, …) — plain JSON |
| `prefectures.bin.br` | All prefectures — Brotli-compressed binary (#74) |
| `prefectures/{code}.bin.br` | Municipalities for that prefecture — Brotli-compressed binary |
| `search-ngrams/2gram/{region}.bin.br` | Hot-set 2-gram search index (JLIX, regional splits) — Brotli (#63) |
| `search-ngrams/3gram/{shard}.bin.br` | Cold-set 3-gram search index (JLIX, 3 shards) — Brotli (#63) |
| `dataset.js` | Default export; decompresses `.bin.br` and decodes at module load (Node-friendly) |
| `decode.js` | Low-level decode functions for the uncompressed `.bin` formats |

A single file of all municipalities is **not** distributed. `schemaVersion` (currently `1`) describes the decoded object shape; it is unrelated to the binary format's own header `version`.

The intermediate CSV and uncompressed `.bin` used to generate the `.bin.br` files live in the repository for review, but are **not** published in this npm package (npm ships Brotli only).

### Size vs previous JSON packaging

Measured against the last JSON release (`1.0.0-rc.3`):

| | JSON (old, rc.3) | Uncompressed `.bin` (#73) | Published `.bin.br` (current) |
| --- | ---: | ---: | ---: |
| Unpacked prefecture + municipality payload | ~436 KiB | ~88 KiB | (wire is Brotli; decode yields `.bin`-sized bytes) |
| Search index | (none / older approach) | (monolith JLIX era) | Hybrid 2-gram / 3-gram partitions |

Size history: [docs/binary-size-73.md](../../docs/binary-size-73.md) (JSON→`.bin`) and [docs/test-spec-63-search-ngrams.md](../../docs/test-spec-63-search-ngrams.md) (hybrid JLIX).

## Import

Default dataset (for the API package):

```ts
import { createLocalGovClient } from "@b4moss/jp-local-gov-id";
import dataset from "@b4moss/jp-local-gov-id-data";

const client = await createLocalGovClient({ data: dataset });
```

`dataset.js` decompresses the bundled `.bin.br` files and decodes them once at import time, so `dataset.prefectures` / `dataset.municipalitiesByCode` / `dataset.searchNgramShards` (raw JLIX partition bytes) are ready for the API package.

```ts
import index from "@b4moss/jp-local-gov-id-data/index.json";
```

`index.json` remains plain JSON and can still be imported directly. `.bin.br` files are binary and are not meant to be `import`ed as JS modules — load them via `dataset.js`, or fetch the raw bytes yourself and pass `{ url }` to `createLocalGovClient` (see the [API package docs](https://www.npmjs.com/package/@b4moss/jp-local-gov-id)).

### Dataset exports

| Export | Description |
|--------|-------------|
| `index` | Index metadata |
| `prefectures` | All prefectures (decoded) |
| `municipalitiesByCode` | Decoded municipality data keyed by prefecture code |
| `loadMunicipalities(code)` | Load municipalities for a prefecture code |
| `searchNgramShards` | Raw JLIX partition bytes (2-gram region / 3-gram shard keys) |

## Self-hosted data

If you host the data yourself, serve it with a **versioned URL** and the same `index.json` + `.bin.br` layout (prefectures, per-prefecture files, and `search-ngrams/**`). Availability, CORS, correctness, and URL operations are your responsibility. Enable CORS on the hosting side.

## About the data

- As of: 1 January 2024 (R6.1.1)
- Source: Ministry of Internal Affairs and Communications (総務省) nationwide local government code Excel (`000925835.xlsx` in the monorepo `resources/`)
- Abolished / merged entities are not included (current only)

## License

MIT

Repository: [b4moss/jp-local-gov-id](https://github.com/b4moss/jp-local-gov-id)
