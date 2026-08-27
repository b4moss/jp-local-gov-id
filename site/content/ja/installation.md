---
title: インストール
description: パッケージのインストール方法
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

## パッケージマネージャーを使わない場合（HTML）

npm / Vite / webpack を使わず、ブラウザから直接読み込むこともできます。

配布されている `dist/jp-local-gov-id.js` は **ES module** です。そのため `<script type="module">` で読み込みます（クラシックな `<script src="...">` だけでは動きません）。

データは `dataset.js` を同梱せず、`url` で分割 JSON を読むのがおすすめです。

### CDN から読む

```html
<!DOCTYPE html>
<html lang="ja">
  <body>
    <script type="module">
      import { createLocalGovClient } from "https://cdn.jsdelivr.net/npm/@b4moss/jp-local-gov-id@1.0.0-rc.2/dist/jp-local-gov-id.js";

      const client = await createLocalGovClient({
        url: "https://cdn.jsdelivr.net/npm/@b4moss/jp-local-gov-id-data@1.0.0-rc.3/index.json",
      });

      console.log(await client.getByCode("131016"));
    </script>
  </body>
</html>
```

`dist/jp-local-gov-id.js` は ES module として公開されています。同じファイルをダウンロードしてセルフホストしても構いません。

### dist をダウンロードして置く

1. API の `dist/jp-local-gov-id.js` を取得する（npm パッケージまたは GitHub / CDN から）
2. データは `index.json`・`prefectures.json`・`prefectures/` を同じ階層で置く（`dataset.js` は不要）
3. HTML から相対パスで読む

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
<html lang="ja">
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

ローカルで `file://` を開くとモジュールや fetch が制限されることがあります。簡単な HTTP サーバ（例: `npx serve`）で確認してください。

次は [使い方](/ja/usage) を参照してください。
