# @b4moss/jp-local-gov-id-data

[English](./README.md)

全国地方公共団体コードヘルパ向けの、日本の全国地方公共団体コードのバイナリ（`.bin`）データです。

このパッケージは**データのみ**を提供します。検索・取得 API が必要な場合は [`@b4moss/jp-local-gov-id`](https://www.npmjs.com/package/@b4moss/jp-local-gov-id) と組み合わせて使うか、同等のファイルを版付きインデックス URL で自前配信してください。

## インストール

```bash
npm install @b4moss/jp-local-gov-id-data
```

## 同梱内容

| パス | 内容 |
|------|------|
| `index.json` | 索引メタデータ（`schemaVersion`・`asOf`・パス・件数など）— 通常の JSON |
| `prefectures.bin.br` | 都道府県のみ — Brotli 圧縮バイナリ（#74） |
| `prefectures/{code}.bin.br` | 当該県の市区町村 — Brotli 圧縮バイナリ |
| `search-ngrams/2gram/{region}.bin.br` | ホット団体の 2-gram 検索索引（JLIX・地域分割）— Brotli（#63） |
| `search-ngrams/3gram/{shard}.bin.br` | コールド団体の 3-gram 検索索引（JLIX・3 シャード）— Brotli（#63） |
| `dataset.js` | API 向けデフォルト export。`.bin.br` を展開・デコードしてから公開形を組み立てます |
| `decode.js` | 非圧縮 `.bin` 形式の低レベルデコード関数 |

全市区町村をまとめた単一ファイルは**配布しません**。`schemaVersion`（現在 `1`）はデコード後オブジェクトの形を表すもので、バイナリ形式自体のヘッダにある `version` とは別物です。

中間 CSV と非圧縮 `.bin` はリポジトリ内に置きますが、npm には**同梱しません**（npm は Brotli のみ）。

### 旧 JSON 配布との容量比較

直前の JSON 配布（`1.0.0-rc.3`）との実測:

| | JSON（旧） | `.bin`（rc.10） |
| --- | ---: | ---: |
| 展開時のデータ本体 | 約 436 KiB | 約 88 KiB（約 20%） |
| `npm pack` の `.tgz`（gzip 後） | 約 41.9 KB | 約 47.8 KB |

展開サイズは大きく減りますが、tarball は JSON の gzip 効率と `decode.js` / 肥大化した `dataset.js` の影響で微増し得ます。詳細は [docs/binary-size-73.md](../../docs/binary-size-73.md)。

## インポート

API パッケージ向けのデフォルトデータセット:

```ts
import { createLocalGovClient } from "@b4moss/jp-local-gov-id";
import dataset from "@b4moss/jp-local-gov-id-data";

const client = await createLocalGovClient({ data: dataset });
```

`dataset.js` は import 時に同梱の `.bin.br` を一度だけ展開・デコードするため、`dataset.prefectures` / `dataset.municipalitiesByCode` / `dataset.searchNgramShards`（JLIX 分割の生バイト）は API パッケージからすぐ使えます。

```ts
import index from "@b4moss/jp-local-gov-id-data/index.json";
```

`index.json` は従来どおり JSON のまま直接インポートできます。`.bin` 自体はバイナリのため、JS モジュールとして直接 `import` するものではありません。`dataset.js` 経由で読むか、バイト列を自前で取得し `createLocalGovClient` に `{ url }` を渡して処理させてください（詳細は [API パッケージのドキュメント](https://www.npmjs.com/package/@b4moss/jp-local-gov-id)を参照）。

### データセットの export

| Export | 説明 |
|--------|------|
| `index` | インデックスメタデータ |
| `prefectures` | 全都道府県（デコード済み） |
| `municipalitiesByCode` | 都道府県コードをキーにしたデコード済み市区町村データ |
| `loadMunicipalities(code)` | 都道府県コードで市区町村を読み込む |

## 自前データ配信

自前で配信する場合も、**バージョン付き URL**と同等の `index.json` + `.bin` 構成で提供してください。可用性・CORS・内容の正しさ・URL 運用は配信側の責任です。CORS は配信側で許可してください。

## データについて

- 時点: 令和 6 年 1 月 1 日（R6.1.1）
- 出典: 総務省 全国地方公共団体コード Excel（モノレポ `resources/` 内の `000925835.xlsx`）
- 廃止・合併済みの団体は含みません（現行のみ）

## ライセンス

MIT

リポジトリ: [b4moss/jp-local-gov-id](https://github.com/b4moss/jp-local-gov-id)
