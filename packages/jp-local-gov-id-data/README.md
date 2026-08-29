# @b4moss/jp-local-gov-id-data

[日本語](./README_ja.md)

Binary (`.bin`) datasets of Japan’s nationwide local government codes (全国地方公共団体コード).

This package ships **data only**. For search and lookup APIs, use [`@b4moss/jp-local-gov-id`](https://www.npmjs.com/package/@b4moss/jp-local-gov-id) with this package, or serve the same files yourself behind a versioned index URL.

## Install

```bash
npm install @b4moss/jp-local-gov-id-data
```

## What’s included

| Path | Contents |
|------|----------|
| `index.json` | Index metadata (`schemaVersion`, `asOf`, paths, counts, …) — plain JSON |
| `prefectures.bin` | All prefectures — binary |
| `prefectures/{code}.bin` | Municipalities for that prefecture (e.g. `13.bin`) — binary |
| `dataset.js` | Default export bundling the above for the API package; decodes the `.bin` files at module load time (Node-friendly) |
| `decode.js` | Low-level decode functions for the `.bin` format, for advanced use (e.g. decoding bytes fetched in a browser) |

A single file of all municipalities is **not** distributed. `schemaVersion` (currently `1`) describes the decoded object shape; it is unrelated to the binary format's own header `version`.

The intermediate CSV used to generate the `.bin` files (`prefectures.csv`, `prefectures/{code}.csv`) lives in the repository for review, but is **not** published in this npm package.

## Import

Default dataset (for the API package):

```ts
import { createLocalGovClient } from "@b4moss/jp-local-gov-id";
import dataset from "@b4moss/jp-local-gov-id-data";

const client = await createLocalGovClient({ data: dataset });
```

`dataset.js` decodes the bundled `.bin` files once, at import time, so `dataset.prefectures` / `dataset.municipalitiesByCode` are already plain objects — identical in shape to the previous JSON-based release.

```ts
import index from "@b4moss/jp-local-gov-id-data/index.json";
```

`index.json` remains plain JSON and can still be imported directly. The `.bin` files themselves are binary and are not meant to be `import`ed as JS modules — load them via `dataset.js`, or fetch the raw bytes yourself and pass `{ url }` to `createLocalGovClient` (see the [API package docs](https://www.npmjs.com/package/@b4moss/jp-local-gov-id)).

### Dataset exports

| Export | Description |
|--------|-------------|
| `index` | Index metadata |
| `prefectures` | All prefectures (decoded) |
| `municipalitiesByCode` | Decoded municipality data keyed by prefecture code |
| `loadMunicipalities(code)` | Load municipalities for a prefecture code |

## Self-hosted data

If you host the data yourself, serve it with a **versioned URL** and the same `index.json` + `.bin` layout. Availability, CORS, correctness, and URL operations are your responsibility. Enable CORS on the hosting side.

## About the data

- As of: 1 January 2024 (R6.1.1)
- Source: Ministry of Internal Affairs and Communications (総務省) nationwide local government code Excel (`000925835.xlsx` in the monorepo `resources/`)
- Abolished / merged entities are not included (current only)

## License

MIT

Repository: [b4moss/jp-local-gov-id](https://github.com/b4moss/jp-local-gov-id)
