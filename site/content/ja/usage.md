---
title: 使い方
description: クライアントの初期化と基本操作
---

# 使い方

まずは、一番シンプルな方法を例示します。

## 一番簡単な例

```ts
import { createLocalGovClient } from "@b4moss/jp-local-gov-id";
import dataset from "@b4moss/jp-local-gov-id-data";

const client = await createLocalGovClient({ data: dataset });

client.listPrefectures();
client.getPrefectureByCode("27"); // 大阪府
client.getPrefectureCodeByName("大阪府"); // "27"
await client.listMunicipalitiesByPrefecture("13"); // 東京都の市区町村等
await client.listMunicipalitiesByPrefecture("01", { designatedCity: "city" }); // 政令市本体のみ
await client.getMunicipalityByCode("131016"); // 千代田区
await client.getByCode("131016");
await client.searchByText("中央", { prefecture: "01", target: "cities" });
await client.searchByText("ちよだ", { prefecture: "13", target: "cities" }); // カナ／ひらがな可
await client.getLocalGovCodeByName("千代田区"); // "131016"
```

### 政令指定都市の市/区フィルタ

住所フォームで「市だけ選びたい」「区だけ選びたい」場合は `designatedCity` を使います（既定 `"both"`）。

| 値 | 意味 | 例（北海道） |
|----|------|--------------|
| `"both"` | 市本体と区の両方 | `札幌市` と `札幌市中央区` |
| `"city"` | 市本体のみ | `札幌市` のみ |
| `"ward"` | 区のみ | `札幌市中央区` など |

適用 API: `listMunicipalitiesByPrefecture` / `searchByText` / `getLocalGovCodeByName`。東京特別区は対象外です。

```ts
// 住所セレクト: 市のみ
await client.listMunicipalitiesByPrefecture("01", { designatedCity: "city" });

// 住所セレクト: 区のみ
await client.listMunicipalitiesByPrefecture("01", { designatedCity: "ward" });

// 検索でも同じオプションが使える
await client.searchByText("札幌", {
  prefecture: "01",
  target: "cities",
  designatedCity: "ward",
});
```

このように、アプリケーションとデータをそれぞれ npm パッケージから呼び出し、読み込めば使用できます。

## 巨大なデータソースへの対処

一方で「**全国のデータをnpmから配信すると、巨大なのでは？**」という疑問もあるでしょう。

はい、この質問に対しては「**YES**」です。v0.1.0のデータソースは、400KBを超えています。

従って、パッケージマネージャーで、アプリ（`@b4moss/jp-local-gov-id`）と、データソース（`@b4moss/jp-local-gov-id-data`）を別々にビルドする方法をお勧めします。

### Viteの場合

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
            "node_modules/@b4moss/jp-local-gov-id-data/prefectures.json",
            "node_modules/@b4moss/jp-local-gov-id-data/prefectures",
          ],
          dest: "jp-local-gov-id-data",
        },
      ],
    }),
  ],
  // 念のため optimize 対象から外す（誤って import しても警告しやすくする）
  optimizeDeps: {
    exclude: ["@b4moss/jp-local-gov-id-data"],
  },
});
```

```ts
// app.ts 等
const client = await createLocalGovClient({
  url: "/jp-local-gov-id-data/index.json",
});
```

### Webpackの場合

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
          from: "node_modules/@b4moss/jp-local-gov-id-data/prefectures.json",
          to: "jp-local-gov-id-data/prefectures.json",
        },
        {
          from: "node_modules/@b4moss/jp-local-gov-id-data/prefectures",
          to: "jp-local-gov-id-data/prefectures",
        },
      ],
    }),
  ],
  // 誤って data パッケージを bundle しない
  externals: {
    // 使う場合のみ。通常は単に import しないのが確実
  },
};
```

```js
// app.js 等
const client = await createLocalGovClient({
  url: "/jp-local-gov-id-data/index.json",
});
```

### データソースを外部から読み込む

そもそも、データソースをセルフホストしたくない、という場合もあるでしょう。

その場合は、データソースを外部から読み込むことができます。

インストール時に、アプリだけインストールするようにします。データソースはインストールしません。

```shell
npm install @b4moss/jp-local-gov-id

# もし既にデータソースをインストールしてしまっていたら、アンインストール
# npm uninstall @b4moss/jp-local-gov-id-data
```

その上で、クライアントを呼び出すときに、`url`オプションを指定してください。

```ts
const client = await createLocalGovClient({
  url: "https://cdn.jsdelivr.net/npm/@b4moss/jp-local-gov-id-data@0.1.0/index.json",
});
```

ここでは、jsDelivr の URL を指定していますが、セルフホストのデータソースを配信し、そこから読み取っても構いません。

その場合、URLにはversionを指定することをお勧めします。アプリにはキャッシュ機能があるため、データソースが更新された場合、URLが一意でないと、古いキャッシュが配信される可能性があります。

```ts
// キャッシュ無効
const client = await createLocalGovClient({
  url: "https://cdn.jsdelivr.net/npm/@b4moss/jp-local-gov-id-data@0.1.0/index.json",
  cache: false,
});

// TTL を 1 時間に
const clientShortTtl = await createLocalGovClient({
  url: "https://cdn.jsdelivr.net/npm/@b4moss/jp-local-gov-id-data@0.1.0/index.json",
  cacheTtlSeconds: 3600,
});
```

- `url` 指定時、取得したファイルを localStorage にキャッシュします（既定 ON。キーは各ファイルの URL）
- `cache: false` で無効化、`cacheTtlSeconds` で有効期限を秒単位で指定（既定 1 年 = `31536000`）
- 例外: **全国対象**の文字列検索で取得した県別 JSON は localStorage に書かず、メモリのみ保持します（キャッシュの巨大化を避けるため）
- localStorage が無い環境（Node 等）ではキャッシュをスキップします
- 文字列検索はひらがな／全角カナを半角カナへ正規化します（`matchField` 既定: `"both"`）
- スキーマ不一致・不正 JSON は `LocalGovSchemaError`、ネットワーク / HTTP エラーは通常の fetch エラーです
- クエリで見つからない・同名衝突の場合は `null` / `[]` を返します（throw しません）

パッケージマネージャーなしで HTML から読み込む方法は [インストール](/ja/installation) を参照してください。

## コード形式

以下のコードに対応しています

- 都道府県コード
  - 2桁の半角数字
  - 1桁の場合、1桁でもゼロ埋め2桁でも同じ挙動
    - `01`と`1`は同じ挙動となる
- 地方公共団体コード
  - チェックデジット込みの6桁
  - チェックデジット欠損時はエラーです

## データソースの構成

| ファイル | 内容 |
|----------|------|
| `index.json` | パス・`schemaVersion`・`asOf` などの索引 |
| `prefectures.json` | 都道府県のみ |
| `prefectures/{code}.json` | 当該県の市区町村（例: `13.json`） |

より詳しい挙動は [API](/ja/api) と [Playground](/ja/playground) を参照してください。
