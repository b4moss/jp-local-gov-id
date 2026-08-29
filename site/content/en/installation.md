---
title: Installation
description: How to install the packages
---

# Installation

## With npm

```bash
# API + official data
npm install @b4moss/jp-local-gov-id @b4moss/jp-local-gov-id-data

# API only (fetch from a versioned index URL)
npm install @b4moss/jp-local-gov-id
```

Use `data` when you install the data package; use `url` when you only install the API. See [Usage](/en/usage).

## Without a package manager (HTML)

`dist/jp-local-gov-id.js` is an **ES module** — load it with `<script type="module">`.

In the browser, prefer `url` + `index.json` / `.bin.br` over bundling `dataset.js` (Node-oriented). The client Brotli-decompresses then decodes.

### From a CDN

```html
<!DOCTYPE html>
<html lang="en">
  <body>
    <script type="module">
      import { createLocalGovClient } from "https://cdn.jsdelivr.net/npm/@b4moss/jp-local-gov-id@1.0.0-rc.10/dist/jp-local-gov-id.js";

      const client = await createLocalGovClient({
        url: "https://cdn.jsdelivr.net/npm/@b4moss/jp-local-gov-id-data@1.0.0-rc.10/index.json",
      });

      console.log(await client.getByCode("131016"));
    </script>
  </body>
</html>
```

### Self-host dist + data

```text
your-site/
  index.html
  vendor/
    jp-local-gov-id.js
  jp-local-gov-id-data/
    index.json
    prefectures.bin.br
    prefectures/
      01.bin.br
      …
    search-ngrams/
      2gram/
        tokyo.bin.br
        …
      3gram/
        0.bin.br
        1.bin.br
        2.bin.br
```

```html
<!DOCTYPE html>
<html lang="en">
  <body>
    <script type="module">
      import { createLocalGovClient } from "./vendor/jp-local-gov-id.js";

      const client = await createLocalGovClient({
        url: "./jp-local-gov-id-data/index.json",
      });

      console.log(await client.getByCode("131016"));
    </script>
  </body>
</html>
```

Opening `file://` may block modules/fetch — use a simple HTTP server (e.g. `npx serve`).

Next: [Usage](/en/usage).
