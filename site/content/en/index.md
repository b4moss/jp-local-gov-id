---
title: Home
description: An npm package for Japan’s nationwide local government codes
---

# jp-local-gov-id

A JavaScript API for working with Japan’s nationwide local government codes.

## What you can do

- List municipalities in a given prefecture
- Fetch prefecture information as a list
- Get municipality counts per prefecture (sync, no municipality JSON load)
- Look up local government codes — unique IDs useful for address normalization

## Installation

```bash
npm install @b4moss/jp-local-gov-id @b4moss/jp-local-gov-id-data
```

See [Installation](/en/installation) for details.

## Quick example

```ts
import { createLocalGovClient } from "@b4moss/jp-local-gov-id";
import dataset from "@b4moss/jp-local-gov-id-data";

const client = await createLocalGovClient({ data: dataset });
await client.getByCode("131016"); // Chiyoda
```

See [Usage](/en/usage) for details.

## Try it

Try code lookup and text search in the browser. For free-form TypeScript, open the [Playground](/en/playground).

### Code lookup

::code-lookup-demo
::

### Text search

::search-demo
::

## Packages

| Package | Description |
|---------|-------------|
| `@b4moss/jp-local-gov-id` | JS API (data not bundled) |
| `@b4moss/jp-local-gov-id-data` | Split JSON datasets |

## Questions and requests

Please use [GitHub Issues](https://github.com/b4m-oss/jp-local-gov-id/issues). (A GitHub account is required.)
