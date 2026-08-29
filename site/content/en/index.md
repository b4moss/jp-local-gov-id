---
title: Home
description: npm packages for Japan’s nationwide local government codes
---

# jp-local-gov-id

JavaScript APIs for Japan’s nationwide local government codes (全国地方公共団体コード).

Data is **not** shipped as a single JSON blob. The data package publishes **Brotli-compressed** `.bin.br` files split by prefecture plus a hybrid n-gram search index, so clients can lazy-load only what they need.

## Examples of what you can do

- List municipalities in a prefecture
- List all prefectures
- Get municipality counts per prefecture (sync; no per-prefecture load)
- Resolve codes for address normalization
- Nationwide string search (hybrid n-gram index narrows candidates first)

## Install

```bash
npm install @b4moss/jp-local-gov-id @b4moss/jp-local-gov-id-data
```

See [Installation](./installation.md) for details.

## Quick example

```ts
import { createLocalGovClient } from "@b4moss/jp-local-gov-id";
import dataset from "@b4moss/jp-local-gov-id-data";

const client = await createLocalGovClient({ data: dataset });
await client.getByCode("131016"); // Chiyoda
```

See [Usage](./usage.md) for more.

## Try it

### Code lookup

::code-lookup-demo
::

### Text

::search-demo
::

## Packages

| Package | Description |
|---------|-------------|
| `@b4moss/jp-local-gov-id` | JS API (data not bundled) |
| `@b4moss/jp-local-gov-id-data` | `index.json` + Brotli binaries (`.bin.br`) + search indexes |

## Questions / requests

Please open a [GitHub Issue](https://github.com/b4moss/jp-local-gov-id/issues).
