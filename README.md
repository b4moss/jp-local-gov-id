# jp-local-gov-id

[![CI](https://github.com/b4moss/jp-local-gov-id/actions/workflows/ci.yml/badge.svg)](https://github.com/b4moss/jp-local-gov-id/actions/workflows/ci.yml)
[![Coverage](https://img.shields.io/codecov/c/github/b4moss/jp-local-gov-id)](https://codecov.io/gh/b4moss/jp-local-gov-id)
[![npm](https://img.shields.io/npm/v/@b4moss/jp-local-gov-id/rc)](https://www.npmjs.com/package/@b4moss/jp-local-gov-id)
[![Release](https://img.shields.io/github/v/release/b4moss/jp-local-gov-id?include_prereleases&filter=app-v*)](https://github.com/b4moss/jp-local-gov-id/releases)
[![License](https://img.shields.io/github/license/b4moss/jp-local-gov-id)](https://github.com/b4moss/jp-local-gov-id/blob/main/LICENSE)
[![OpenSSF Scorecard](https://api.securityscorecards.dev/projects/github.com/b4moss/jp-local-gov-id/badge)](https://securityscorecards.dev/viewer/?uri=github.com/b4moss/jp-local-gov-id)

[日本語](./README_ja.md)

A monorepo for Japan’s nationwide local government codes (npm workspaces).

**Docs / Playground:** [https://jplocalgov.oss.b4m.jp/](https://jplocalgov.oss.b4m.jp/)

| Package | Description | Version |
|---------|-------------|---------|
| [`@b4moss/jp-local-gov-id`](./packages/jp-local-gov-id) | JS API (data not bundled; lazy-loaded) | 1.0.0-rc.10 |
| [`@b4moss/jp-local-gov-id-data`](./packages/jp-local-gov-id-data) | `index.json` + binary (`.bin`) datasets | 1.0.0-rc.10 |

## Install (consumers)

```bash
# API + official data (import from npm and pass in)
npm install @b4moss/jp-local-gov-id @b4moss/jp-local-gov-id-data

# API only (fetch from a versioned index URL)
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
client.getPrefectureByCode("27"); // Osaka
client.getMunicipalityCountByPrefecture("01"); // sync; no municipality data load
client.getMunicipalityCountByPrefecture("北海道", { designatedCity: "city" });
client.getPrefectureCodeByName("大阪府"); // "27"
await client.listMunicipalitiesByPrefecture("13"); // municipalities in Tokyo, etc.
await client.getMunicipalityByCode("131016"); // Chiyoda City
await client.getByCode("131016");
await client.searchByText("中央", { prefecture: "01", target: "cities" });
await client.searchByText("ちよだ", { prefecture: "13", target: "cities" }); // kana / hiragana OK
await client.getLocalGovCodeByName("千代田区"); // "131016"
```

Fetch from a versioned index URL:

```ts
const client = await createLocalGovClient({
  url: "https://example.com/jp-local-gov-id-data/1.0.0-rc.10/index.json",
});
```

- When `url` is set, fetched files are decoded and cached in localStorage by default (key = file URL). The cached value is a minified `JSON.stringify` of the decoded object — the `.bin` bytes themselves are never cached (Brotli compression is out of scope for this release; tracked in [#74](https://github.com/b4moss/jp-local-gov-id/issues/74))
- Disable with `cache: false`; set TTL via `cacheTtlSeconds` (seconds; default 1 year = `31536000`)
- Exception: municipality data loaded by **nationwide** string search is kept in memory only (not written to localStorage)
- Environments without localStorage (e.g. Node) skip caching
- String search normalizes hiragana / fullwidth kana to halfwidth kana (`matchField` default: `"both"`)
- Schema mismatches, invalid JSON, or invalid `.bin` data raise `LocalGovSchemaError`; network / HTTP failures are normal fetch errors
- Missing or ambiguous query results return `null` / `[]` (they do not throw)

### Data layout

A single file of all municipalities is not distributed. The data package ships binary (`.bin`) datasets plus a plain-JSON `index.json`.

| File | Contents |
|------|----------|
| `index.json` | Index of paths, `schemaVersion`, `asOf`, etc. — plain JSON |
| `prefectures.bin` | Prefectures only — binary |
| `prefectures/{code}.bin` | Municipalities for that prefecture (e.g. `13.bin`) — binary |

`schemaVersion` (currently `1`) describes the decoded object shape; it is unrelated to the binary format's own header `version`. The intermediate CSV used to generate the `.bin` files lives in the repository for review but is not published to npm.

### Hosting your own data

If you host the data yourself, serve it with a **versioned URL** and the same `index.json` + `.bin` layout as the official package. The package maintainers take no responsibility for availability, CORS, correctness, or URL management. Enable CORS on the hosting side.

## Code formats

| Target | Format | Accepted input |
|--------|--------|----------------|
| Prefecture | 2-digit half-width digits | With or without zero-padding (`"1"` / `"01"`) |
| Municipality | 6 digits including check digit | 6 digits is the canonical form |

## Development (monorepo)

```bash
npm install
npm run generate   # Excel → CSV (repo-only) → split .bin + index.json under packages/jp-local-gov-id-data/
npm test
npm run build
```

Before opening or updating a PR to `develop` / `dev-*`, run local CI:

```bash
npm run ci:local            # preferred (nektos/act + Docker)
npm run ci:local:fallback   # only if Docker is unavailable
```

See [docs/ci-cd.md](./docs/ci-cd.md) for triggers, skip rules, and publish.

## Versioning

Follows [Semantic Versioning](https://semver.org/).

| Change | Version bump |
|--------|--------------|
| Bug fixes | **patch** |
| Data updates (e.g. municipal mergers) | data package **minor** |
| Breaking API changes (0.x) | **minor** |
| Breaking API changes (1.x+) | **major** |

## About the data

- As of: 1 January 2024 (R6.1.1)
- Source file: `resources/000925835.xlsx`
- Abolished / merged entities are not included (current only)
- The API package does not ship data (pass `@b4moss/jp-local-gov-id-data` or a URL)

See [docs/main.md](./docs/main.md) for details.

## License

MIT
