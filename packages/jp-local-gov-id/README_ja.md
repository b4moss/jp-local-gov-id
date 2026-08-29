# @b4moss/jp-local-gov-id

[English](./README.md)

全国地方公共団体コードヘルパの JS API です。日本の全国地方公共団体コードを扱います。データは**同梱しません**。`@b4moss/jp-local-gov-id-data` または版付きインデックス URL を渡してください。

## インストール

```bash
npm install @b4moss/jp-local-gov-id @b4moss/jp-local-gov-id-data
# または API のみ:
npm install @b4moss/jp-local-gov-id
```

## 使い方

`createLocalGovClient` は async です。`data` または `url`（**index.json** の版付き URL）のいずれかが必須です。

初期化ではインデックスと都道府県のみを読み込み（`.bin` はデコード済み）、市区町村は県単位で遅延ロードします。全国対象の文字列検索では、未ロードの県別 `.bin` を同時 6 件で取得・デコードします。

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

- `url` 指定時、取得したファイルを localStorage にキャッシュします（既定 ON。キーは各ファイルの URL）。保存するのはデコード後オブジェクトを `JSON.stringify` した文字列（minify。Brotli 等の圧縮はしません）
- `cache: false` で無効化、`cacheTtlSeconds` で有効期限を秒単位で指定（既定 1 年 = `31536000`）
- 例外: **全国対象**の文字列検索で取得した県別データは localStorage に書かず、メモリのみ保持します
- localStorage が無い環境（Node 等）ではキャッシュをスキップします
- 文字列検索はひらがな／全角カナを半角カナへ正規化します（`matchField` 既定: `"both"`）
- スキーマ不一致・不正なデータは `LocalGovSchemaError`、ネットワーク / HTTP エラーは通常の fetch エラーです
- クエリで見つからない・同名衝突の場合は `null` / `[]` を返します（throw しません）

## コード形式

| 対象 | 形式 | 入力時の許容 |
|------|------|--------------|
| 都道府県 | 半角数字 2 桁 | 0 埋めの有無どちらも可（`"1"` / `"01"`） |
| 市区町村 | チェックデジット込みの 6 桁 | 6 桁を正式とする |

## ライセンス

MIT

データ構成・バージョン方針・開発手順は [モノレポ README](../../README_ja.md) を参照してください。
