# @b4moss/jp-local-gov-id

[English](./README.md)

全国地方公共団体コードヘルパの JS API です。日本の全国地方公共団体コードを扱います。データは**同梱しません**。`@b4moss/jp-local-gov-id-data` または版付きインデックス URL を渡してください。

## インストール

```bash
npm install @b4moss/jp-local-gov-id @b4moss/jp-local-gov-id-data
# または API のみ:
npm install @b4moss/jp-local-gov-id
```

ESM と CommonJS の両方を配布しています（`import` / `require`）。HTML / CDN では minify 済み IIFE（`dist/jp-local-gov-id.iife.min.js`）と、**同じ版**のデータ `index.json` URL をセットで使うのがおすすめです。詳細は [インストール](https://jplocalgov.oss.b4m.jp/ja/installation) を参照してください。

## 使い方

`createLocalGovClient` は async です。`data` または `url`（**index.json** の版付き URL）のいずれかが必須です。

初期化では `index.json` と都道府県（`.bin.br` を展開・デコード）のみを読み込み、市区町村は県単位で遅延ロードします。全国文字列検索はハイブリッド JLIX（ホットは 2-gram 地域、その他は 3-gram シャード）で候補を絞り、該当県の `.bin.br` だけを同時最大 6 件で取得します。

```ts
import { createLocalGovClient } from "@b4moss/jp-local-gov-id";
import dataset from "@b4moss/jp-local-gov-id-data";

const client = await createLocalGovClient({ data: dataset });

client.listPrefectures();
client.getPrefectureByCode("27");
client.getPrefectureCodeByName("大阪府"); // "27"
client.getMunicipalityCountByPrefecture("01"); // 同期・県別データ不要
client.getMunicipalityCountByPrefecture("北海道", { designatedCity: "city" });
await client.listMunicipalitiesByPrefecture("13");
await client.listMunicipalitiesByPrefecture("01", { designatedCity: "city" }); // 政令市本体のみ
await client.getMunicipalityByCode("131016");
await client.getByCode("131016");
await client.searchByText("中央", { prefecture: "01", target: "cities" });
await client.searchByText("ちよだ", { prefecture: "13", target: "cities" });
await client.getLocalGovCodeByName("千代田区"); // "131016"
```

`designatedCity`（`"both"` | `"city"` | `"ward"`、既定 `"both"`）で、政令指定都市の市本体 / 行政区の出し分けができます。適用 API は `listMunicipalitiesByPrefecture` / `searchByText` / `getLocalGovCodeByName` / `getMunicipalityCountByPrefecture`。東京特別区は対象外です。

版付きインデックス URL から取得する場合:

```ts
const client = await createLocalGovClient({
  url: "https://example.com/jp-local-gov-id-data/1.0.0-rc.10/index.json",
});
```

- `url` 指定時、取得したファイルを展開・デコードして localStorage にキャッシュします（既定 ON）。保存するのはデコード後オブジェクトの minify JSON。**転送の `.bin.br`（Brotli）とは別**で、localStorage に生バイトは置きません
- `cache: false` で無効化、`cacheTtlSeconds` で TTL（秒。既定 1 年）
- 例外: **全国対象**の文字列検索で取得した県別データと JLIX はメモリのみ
- 正規化後長が 2 未満 → 空 / 2 → ホット 2-gram のみ / 3 以上 → 2-gram と 3-gram をマージ
- スキーマ不一致・不正データ → `LocalGovSchemaError`。見つからない・衝突 → `null` / `[]`

## コード形式

| 対象 | 形式 | 入力時の許容 |
|------|------|--------------|
| 都道府県 | 半角数字 2 桁 | 0 埋めの有無どちらも可（`"1"` / `"01"`） |
| 市区町村 | チェックデジット込みの 6 桁 | 6 桁を正式とする |

## ライセンス

MIT

データ構成・バージョン方針・開発手順は [モノレポ README](../../README_ja.md) を参照してください。
