# @b4moss/jp-local-gov-id

[日本語](./README_ja.md)

JS API for Japan’s nationwide local government codes. Data is **not** bundled — pass `@b4moss/jp-local-gov-id-data` or a versioned index URL.

## Install

```bash
npm install @b4moss/jp-local-gov-id @b4moss/jp-local-gov-id-data
# or API only:
npm install @b4moss/jp-local-gov-id
```

ESM and CommonJS are both published (`import` / `require`). For plain HTML / CDN, prefer the minified IIFE (`dist/jp-local-gov-id.iife.min.js`) with a **matching** versioned data `index.json` URL — see the [installation docs](https://jplocalgov.oss.b4m.jp/en/installation).

## Usage

`createLocalGovClient` is async. Either `data` or `url` (a **versioned URL** to **index.json**) is required.

On init it loads only the index and prefectures (Brotli-decompress + decode from `.bin.br`). Municipalities are lazy-loaded per prefecture. Nationwide string search uses a hybrid JLIX index (hot: regional 2-gram files; cold: 3-gram shards), then fetches only candidate prefecture `.bin.br` files with concurrency 6.

```ts
import { createLocalGovClient } from "@b4moss/jp-local-gov-id";
import dataset from "@b4moss/jp-local-gov-id-data";

const client = await createLocalGovClient({ data: dataset });

client.listPrefectures();
client.getPrefectureByCode("27");
client.getPrefectureCodeByName("大阪府"); // "27"
client.getMunicipalityCountByPrefecture("01"); // sync; no municipality data load
client.getMunicipalityCountByPrefecture("北海道", { designatedCity: "city" });
await client.listMunicipalitiesByPrefecture("13");
await client.listMunicipalitiesByPrefecture("01", { designatedCity: "city" }); // city body only
await client.getMunicipalityByCode("131016");
await client.getByCode("131016");
await client.searchByText("中央", { prefecture: "01", target: "cities" });
await client.searchByText("ちよだ", { prefecture: "13", target: "cities" });
await client.getLocalGovCodeByName("千代田区"); // "131016"
```

`designatedCity` (`"both"` | `"city"` | `"ward"`, default `"both"`) filters designated-city bodies vs wards on `listMunicipalitiesByPrefecture`, `searchByText`, `getLocalGovCodeByName`, and `getMunicipalityCountByPrefecture`. Tokyo special wards are not affected.

Fetch from a versioned index URL:

```ts
const client = await createLocalGovClient({
  url: "https://example.com/jp-local-gov-id-data/1.0.0-rc.11/index.json",
});
```

- When `url` is set, fetched files are decompressed/decoded and cached in localStorage by default. The cached string is a minified `JSON.stringify` of the decoded object — **separate from on-wire `.bin.br` (Brotli)**; raw bytes are never stored in localStorage
- Disable with `cache: false`; set TTL via `cacheTtlSeconds` (seconds; default 1 year = `31536000`)
- Exception: municipality data and JLIX loaded by **nationwide** string search stay in memory only
- After normalize: length &lt; 2 → empty; length 2 → hot 2-gram only; length ≥ 3 → merge 2-gram and 3-gram
- Schema mismatches or invalid data raise `LocalGovSchemaError`; missing/ambiguous results return `null` / `[]`

## Code formats

| Target | Format | Accepted input |
|--------|--------|----------------|
| Prefecture | 2-digit half-width digits | With or without zero-padding (`"1"` / `"01"`) |
| Municipality | 6 digits including check digit | 6 digits is the canonical form |

## License

MIT

See the [monorepo README](../../README.md) for data layout, versioning, and development notes.
