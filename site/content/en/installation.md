---
title: Installation
description: How to install the packages
---

# Installation

## Using npm

```bash
# API + official data
npm install @b4moss/jp-local-gov-id @b4moss/jp-local-gov-id-data

# API only (fetch from a versioned index URL)
npm install @b4moss/jp-local-gov-id
```

With the data package, initialize via the `data` option; with API only, use the `url` option. See [Usage](/en/usage) for details.

## Without a package manager (HTML)

You can load the library directly in the browser without npm, Vite, or webpack.

The shipped `dist/jp-local-gov-id.js` is an **ES module**. Use `<script type="module">` (a classic `<script src="...">` alone will not work).

Prefer loading split JSON via `url` rather than bundling `dataset.js`.

### From a CDN

```html
<!DOCTYPE html>
<html lang="en">
  <body>
    <script type="module">
      import { createLocalGovClient } from "https://cdn.jsdelivr.net/npm/@b4moss/jp-local-gov-id@0.6.0/dist/jp-local-gov-id.js";

      const client = await createLocalGovClient({
        url: "https://cdn.jsdelivr.net/npm/@b4moss/jp-local-gov-id-data@1.0.0-rc.1/index.json",
      });

      console.log(await client.getByCode("131016"));
    </script>
  </body>
</html>
```

`dist/jp-local-gov-id.js` is published as an ES module. You can download the same file and self-host it.

### Download `dist` and host it yourself

1. Get the API file `dist/jp-local-gov-id.js` (from the npm package, GitHub, or a CDN)
2. Place `index.json`, `prefectures.json`, and `prefectures/` together (you do not need `dataset.js`)
3. Import them from HTML with relative paths

```text
your-site/
  index.html
  vendor/
    jp-local-gov-id.js
  jp-local-gov-id-data/
    index.json
    prefectures.json
    prefectures/
      01.json
      …
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

Opening via `file://` may block modules or fetch. Use a simple HTTP server (e.g. `npx serve`) to verify.

Continue with [Usage](/en/usage).
