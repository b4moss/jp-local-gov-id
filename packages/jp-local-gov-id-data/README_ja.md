# @b4moss/jp-local-gov-id-data

[English](./README.md)

全国地方公共団体コードヘルパ向けの、日本の全国地方公共団体コードの分割 JSON データです。

このパッケージは**データのみ**を提供します。検索・取得 API が必要な場合は [`@b4moss/jp-local-gov-id`](https://www.npmjs.com/package/@b4moss/jp-local-gov-id) と組み合わせて使うか、同等のファイルを版付きインデックス URL で自前配信してください。

## インストール

```bash
npm install @b4moss/jp-local-gov-id-data
```

## 同梱内容

| パス | 内容 |
|------|------|
| `index.json` | 索引メタデータ（`schemaVersion`・`asOf`・パス・件数など） |
| `prefectures.json` | 都道府県のみ |
| `prefectures/{code}.json` | 当該県の市区町村（例: `13.json`） |
| `dataset.js` | API パッケージ向けのデフォルト export |

全市区町村をまとめた単一 JSON は**配布しません**。

## インポート

API パッケージ向けのデフォルトデータセット:

```ts
import { createLocalGovClient } from "@b4moss/jp-local-gov-id";
import dataset from "@b4moss/jp-local-gov-id-data";

const client = await createLocalGovClient({ data: dataset });
```

個別 JSON:

```ts
import index from "@b4moss/jp-local-gov-id-data/index.json";
import prefectures from "@b4moss/jp-local-gov-id-data/prefectures.json";
import tokyo from "@b4moss/jp-local-gov-id-data/prefectures/13.json";
```

### データセットの export

| Export | 説明 |
|--------|------|
| `index` | インデックスメタデータ |
| `prefectures` | 全都道府県 |
| `municipalitiesByCode` | 都道府県コードをキーにした市区町村ファイル |
| `loadMunicipalities(code)` | 都道府県コードで市区町村を読み込む |

## 自前データ配信

自前で JSON を配信する場合も、**バージョン付き URL**と同等の分割ファイル構成で提供してください。可用性・CORS・内容の正しさ・URL 運用は配信側の責任です。CORS は配信側で許可してください。

## データについて

- 時点: 令和 6 年 1 月 1 日（R6.1.1）
- 出典: 総務省 全国地方公共団体コード Excel（モノレポ `resources/` 内の `000925835.xlsx`）
- 廃止・合併済みの団体は含みません（現行のみ）

## ライセンス

MIT

リポジトリ: [b4moss/jp-local-gov-id](https://github.com/b4moss/jp-local-gov-id)
