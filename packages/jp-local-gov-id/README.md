# @b4moss/jp-local-gov-id

[日本語](./README_ja.md)

JS API for Japan’s nationwide local government codes. Data is **not** bundled — pass `@b4moss/jp-local-gov-id-data` or a versioned index URL.

## Install

```bash
npm install @b4moss/jp-local-gov-id @b4moss/jp-local-gov-id-data
# or API only:
npm install @b4moss/jp-local-gov-id
```

## Usage

`createLocalGovClient` is async. Either `data` or `url` (a **versioned URL** to **index.json**) is required.

On init it loads only the index and prefectures (decoded from `.bin`); municipalities are lazy-loaded per prefecture. Nationwide string search fetches and decodes unloaded prefecture `.bin` files with concurrency of 6.

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
  url: "https://example.com/jp-local-gov-id-data/1.0.0-rc.10/index.json",
});
```

- When `url` is set, fetched files are decoded and cached in localStorage by default (key = file URL). The cached string is a minified `JSON.stringify` of the decoded object (Brotli compression is out of scope for this release; tracked in [#74](https://github.com/b4moss/jp-local-gov-id/issues/74))
- Disable with `cache: false`; set TTL via `cacheTtlSeconds` (seconds; default 1 year = `31536000`)
- Exception: municipality data loaded by **nationwide** string search is kept in memory only (not written to localStorage)
- Environments without localStorage (e.g. Node) skip caching
- String search normalizes hiragana / fullwidth kana to halfwidth kana (`matchField` default: `"both"`)
- Schema mismatches or invalid data (JSON or `.bin`) raise `LocalGovSchemaError`; network / HTTP failures are normal fetch errors
- Missing or ambiguous query results return `null` / `[]` (they do not throw)

## Code formats

| Target | Format | Accepted input |
|--------|--------|----------------|
| Prefecture | 2-digit half-width digits | With or without zero-padding (`"1"` / `"01"`) |
| Municipality | 6 digits including check digit | 6 digits is the canonical form |

## License

MIT

See the [monorepo README](../../README.md) for data layout, versioning, and development notes.
