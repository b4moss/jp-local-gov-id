---
title: 使い方
description: クライアントの初期化と基本操作
---

# 使い方

## 一番簡単な例

```ts
import { createLocalGovClient } from "@b4moss/jp-local-gov-id";
import dataset from "@b4moss/jp-local-gov-id-data";

const client = await createLocalGovClient({ data: dataset });

client.listPrefectures();
client.getPrefectureByCode("27"); // 大阪府
client.getPrefectureCodeByName("大阪府"); // "27"
client.getMunicipalityCountByPrefecture("01"); // 同期・県別データ不要
client.getMunicipalityCountByPrefecture("北海道", { designatedCity: "city" });
await client.listMunicipalitiesByPrefecture("13"); // 東京都の市区町村等
await client.listMunicipalitiesByPrefecture("01", { designatedCity: "city" }); // 政令市本体のみ
await client.getMunicipalityByCode("131016"); // 千代田区
await client.getByCode("131016");
await client.searchByText("中央", { prefecture: "01", target: "cities" });
await client.searchByText("ちよだ", { prefecture: "13", target: "cities" }); // カナ／ひらがな可
await client.getLocalGovCodeByName("千代田区"); // "131016"
```

### 政令指定都市の市/区フィルタ

| 値 | 意味 | 例（北海道） |
|----|------|--------------|
| `"both"` | 市本体と区の両方 | `札幌市` と `札幌市中央区` |
| `"city"` | 市本体のみ | `札幌市` のみ |
| `"ward"` | 区のみ | `札幌市中央区` など |

適用 API: `listMunicipalitiesByPrefecture` / `searchByText` / `getLocalGovCodeByName` / `getMunicipalityCountByPrefecture`。東京特別区は対象外です。

## データは重い？ — 分割 + Brotli + 索引

旧 JSON 一括配布（数百 KB 超）の時代とは構成が違います。

- **npm 配信は `.bin.br`（Brotli）のみ**。都道府県・県別・検索索引を分割
- 初期化は `index.json` + 都道府県のみ（都道府県ファイルは約 1 KB 級）
- 全国検索はハイブリッド JLIX で候補を絞り、**該当県だけ**追加取得（全都道府県の全件ロードはしない）
- SPA に `dataset.js` をバンドルすると肥大化しやすいので、ブラウザでは **`url` + 静的コピー**を推奨

### Vite の場合

```shell
npm i -D vite-plugin-static-copy
```

```ts
// vite.config.ts
import { defineConfig } from "vite";
import { viteStaticCopy } from "vite-plugin-static-copy";
export default defineConfig({
  plugins: [
    viteStaticCopy({
      targets: [
        {
          // dataset.js はコピーしない（バンドル肥大化の元）
          src: [
            "node_modules/@b4moss/jp-local-gov-id-data/index.json",
            "node_modules/@b4moss/jp-local-gov-id-data/prefectures.bin.br",
            "node_modules/@b4moss/jp-local-gov-id-data/prefectures",
            "node_modules/@b4moss/jp-local-gov-id-data/search-ngrams",
          ],
          dest: "jp-local-gov-id-data",
        },
      ],
    }),
  ],
  optimizeDeps: {
    exclude: ["@b4moss/jp-local-gov-id-data"],
  },
});
```

```ts
const client = await createLocalGovClient({
  url: "/jp-local-gov-id-data/index.json",
});
```

### Webpack の場合

```shell
npm i -D copy-webpack-plugin
```

```js
// webpack.config.js
const path = require("path");
const CopyWebpackPlugin = require("copy-webpack-plugin");

module.exports = {
  entry: "./src/main.js",
  output: {
    path: path.resolve(__dirname, "dist"),
    filename: "app.js",
    clean: true,
  },
  plugins: [
    new CopyWebpackPlugin({
      patterns: [
        {
          from: "node_modules/@b4moss/jp-local-gov-id-data/index.json",
          to: "jp-local-gov-id-data/index.json",
        },
        {
          from: "node_modules/@b4moss/jp-local-gov-id-data/prefectures.bin.br",
          to: "jp-local-gov-id-data/prefectures.bin.br",
        },
        {
          from: "node_modules/@b4moss/jp-local-gov-id-data/prefectures",
          to: "jp-local-gov-id-data/prefectures",
        },
        {
          from: "node_modules/@b4moss/jp-local-gov-id-data/search-ngrams",
          to: "jp-local-gov-id-data/search-ngrams",
        },
      ],
    }),
  ],
};
```

### CDN / セルフホストから読む

```ts
const client = await createLocalGovClient({
  url: "https://cdn.jsdelivr.net/npm/@b4moss/jp-local-gov-id-data@1.0.0-rc.11/index.json",
});
```

URL は **バージョン付き**にしてください（キャッシュキーが URL のため）。

- `url` 指定時、取得ファイルを展開・デコードして localStorage にキャッシュ（既定 ON）。保存はデコード後オブジェクトの minify JSON。**転送の `.bin.br` とは別**
- 例外: **全国対象**の文字列検索で取得した県別データと JLIX はメモリのみ
- 正規化後長が 2 未満 → 空 / 2 → ホット 2-gram のみ / 3 以上 → 2-gram と 3-gram をマージ
- スキーマ不一致・不正データ → `LocalGovSchemaError`

## コード形式

- 都道府県コード: 2 桁半角数字（`"1"` / `"01"` 同一視）
- 地方公共団体コード: チェックデジット込み 6 桁

## データソースの構成

| ファイル | 内容 |
|----------|------|
| `index.json` | パス・`schemaVersion`・`asOf` などの索引 |
| `prefectures.bin.br` | 都道府県のみ |
| `prefectures/{code}.bin.br` | 当該県の市区町村 |
| `search-ngrams/2gram/{region}.bin.br` | ホット団体の 2-gram 索引（地域分割） |
| `search-ngrams/3gram/{shard}.bin.br` | コールド団体の 3-gram 索引（3 シャード） |

より詳しい挙動は [API](/ja/api) と [Playground](/ja/playground) を参照してください。
