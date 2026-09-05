---
title: インストール
description: パッケージのインストール方法
schemaRole: HowTo
---

# インストール

## npm を使う場合

```bash
# API + 公式データ
npm install @b4moss/jp-local-gov-id @b4moss/jp-local-gov-id-data

# API のみ（版付きインデックス URL から取得）
npm install @b4moss/jp-local-gov-id
```

データ付きで入れる場合は `data` オプション、API のみの場合は `url` オプションで初期化します。詳しくは [使い方](/ja/usage) を参照してください。

ESM（`import`）と CommonJS（`require`）の両方を配布しています。

```js
// ESM
import { createLocalGovClient } from "@b4moss/jp-local-gov-id";

// CommonJS
const { createLocalGovClient } = require("@b4moss/jp-local-gov-id");
```

## パッケージマネージャーを使わない場合（HTML）

npm / Vite / webpack を使わず、ブラウザから直接読み込むこともできます。

ブラウザでは `dataset.js`（Node 向け）をバンドルせず、`url` で `index.json` + `.bin.br` を読むのがおすすめです。クライアントが Brotli を展開してからデコードします（モダンブラウザの `DecompressionStream("brotli")` を利用）。

CDN では **JS（API）とデータ（版付き `index.json`）を同じ版でセット**にして使ってください。

### CDN から読む（推奨: minify IIFE）

バンドラーなしの HTML では、CDN 向けの minify 済み IIFE が手軽です。グローバル `JpLocalGovId` に API が載ります。

```html
<!DOCTYPE html>
<html lang="ja">
  <body>
    <script src="https://cdn.jsdelivr.net/npm/@b4moss/jp-local-gov-id@1.0.0-rc.11/dist/jp-local-gov-id.iife.min.js"></script>
    <script>
      const { createLocalGovClient } = JpLocalGovId;

      createLocalGovClient({
        url: "https://cdn.jsdelivr.net/npm/@b4moss/jp-local-gov-id-data@1.0.0-rc.11/index.json",
      }).then(async (client) => {
        console.log(await client.getByCode("131016"));
      });
    </script>
  </body>
</html>
```

デバッグ用の非 minify IIFE は `dist/jp-local-gov-id.iife.js` です。

### CDN から読む（ES module）

`dist/jp-local-gov-id.js` は **ES module** です。`<script type="module">` で読み込みます。

```html
<!DOCTYPE html>
<html lang="ja">
  <body>
    <script type="module">
      import { createLocalGovClient } from "https://cdn.jsdelivr.net/npm/@b4moss/jp-local-gov-id@1.0.0-rc.11/dist/jp-local-gov-id.js";

      const client = await createLocalGovClient({
        url: "https://cdn.jsdelivr.net/npm/@b4moss/jp-local-gov-id-data@1.0.0-rc.11/index.json",
      });

      console.log(await client.getByCode("131016"));
    </script>
  </body>
</html>
```

### dist をダウンロードして置く

1. API の `dist/jp-local-gov-id.iife.min.js`（または ESM の `jp-local-gov-id.js`）を取得する
2. データは次を同じ階層で置く（`dataset.js` は不要）
3. HTML から相対パスで読む

```text
your-site/
  index.html
  vendor/
    jp-local-gov-id.iife.min.js
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
<html lang="ja">
  <body>
    <script src="./vendor/jp-local-gov-id.iife.min.js"></script>
    <script>
      const { createLocalGovClient } = JpLocalGovId;

      createLocalGovClient({
        url: "./jp-local-gov-id-data/index.json",
      }).then(async (client) => {
        console.log(await client.getByCode("131016"));
      });
    </script>
  </body>
</html>
```

ローカルで `file://` を開くとモジュールや fetch が制限されることがあります。簡単な HTTP サーバ（例: `npx serve`）で確認してください。

次は [使い方](/ja/usage) を参照してください。
