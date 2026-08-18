# @b4moss/jp-local-gov-id-data

[日本語](./README_ja.md)

Split JSON datasets of Japan’s nationwide local government codes (全国地方公共団体コード).

This package ships **data only**. For search and lookup APIs, use [`@b4moss/jp-local-gov-id`](https://www.npmjs.com/package/@b4moss/jp-local-gov-id) with this package, or serve the same files yourself behind a versioned index URL.

## Install

```bash
npm install @b4moss/jp-local-gov-id-data
```

## What’s included

| Path | Contents |
|------|----------|
| `index.json` | Index metadata (`schemaVersion`, `asOf`, paths, counts, …) |
| `prefectures.json` | All prefectures |
| `prefectures/{code}.json` | Municipalities for that prefecture (e.g. `13.json`) |
| `dataset.js` | Default export bundling the above for the API package |

A single JSON file of all municipalities is **not** distributed.

## Import

Default dataset (for the API package):

```ts
import { createLocalGovClient } from "@b4moss/jp-local-gov-id";
import dataset from "@b4moss/jp-local-gov-id-data";

const client = await createLocalGovClient({ data: dataset });
```

Individual JSON files:

```ts
import index from "@b4moss/jp-local-gov-id-data/index.json";
import prefectures from "@b4moss/jp-local-gov-id-data/prefectures.json";
import tokyo from "@b4moss/jp-local-gov-id-data/prefectures/13.json";
```

### Dataset exports

| Export | Description |
|--------|-------------|
| `index` | Index metadata |
| `prefectures` | All prefectures |
| `municipalitiesByCode` | Municipality files keyed by prefecture code |
| `loadMunicipalities(code)` | Load municipalities for a prefecture code |

## Self-hosted data

If you host the JSON yourself, serve it with a **versioned URL** and the same split-file layout. Availability, CORS, correctness, and URL operations are your responsibility. Enable CORS on the hosting side.

## About the data

- As of: 1 January 2024 (R6.1.1)
- Source: Ministry of Internal Affairs and Communications (総務省) nationwide local government code Excel (`000925835.xlsx` in the monorepo `resources/`)
- Abolished / merged entities are not included (current only)

## License

MIT

Repository: [b4moss/jp-local-gov-id](https://github.com/b4moss/jp-local-gov-id)
