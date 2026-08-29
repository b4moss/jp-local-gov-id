---
title: Getting started
description: Overview and next steps
---

# Getting started

jp-local-gov-id is an npm package for working with Japan’s nationwide local government codes from JavaScript.

There are two packages:

- `@b4moss/jp-local-gov-id` — API
- `@b4moss/jp-local-gov-id-data` — data (`index.json` + `.bin.br` + search indexes)

This is **not** the old single JSON dump. Payloads are Brotli-compressed binaries, and nationwide search uses a hybrid n-gram index.

See [Usage](./usage.md) for details.

## Next steps

1. [Installation](/en/installation)
2. [Usage](/en/usage)
3. [API](/en/api)
4. [Playground](/en/playground)

Examples live under [Examples](/en/examples).
