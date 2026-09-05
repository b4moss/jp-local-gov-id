# 全国地方公共団体コードヘルパ

[![CI](https://github.com/b4moss/jp-local-gov-id/actions/workflows/ci.yml/badge.svg)](https://github.com/b4moss/jp-local-gov-id/actions/workflows/ci.yml)
[![Coverage](https://img.shields.io/codecov/c/github/b4moss/jp-local-gov-id)](https://codecov.io/gh/b4moss/jp-local-gov-id)
[![npm](https://img.shields.io/npm/v/@b4moss/jp-local-gov-id/rc)](https://www.npmjs.com/package/@b4moss/jp-local-gov-id)
[![Release](https://img.shields.io/github/v/release/b4moss/jp-local-gov-id?include_prereleases&filter=app-v*)](https://github.com/b4moss/jp-local-gov-id/releases)
[![License](https://img.shields.io/github/license/b4moss/jp-local-gov-id)](https://github.com/b4moss/jp-local-gov-id/blob/main/LICENSE)
[![OpenSSF Scorecard](https://img.shields.io/badge/dynamic/json?url=https%3A%2F%2Fapi.scorecard.dev%2Fprojects%2Fgithub.com%2Fb4moss%2Fjp-local-gov-id&label=OpenSSF%20Scorecard&query=$.score)](https://scorecard.dev/viewer/?uri=github.com/b4moss/jp-local-gov-id)

[English](./README.md)

日本の全国地方公共団体コードを扱うモノレポです（npm workspaces）。npm パッケージ名は `jp-local-gov-id` です。

**ドキュメント / Playground:** [https://jplocalgov.oss.b4m.jp/](https://jplocalgov.oss.b4m.jp/)

| パッケージ | 説明 | バージョン |
|------------|------|------------|
| [`@b4moss/jp-local-gov-id`](./packages/jp-local-gov-id) | JS API（データ非同梱・遅延ロード） | 1.0.0-rc.11 |
| [`@b4moss/jp-local-gov-id-data`](./packages/jp-local-gov-id-data) | `index.json` + Brotli バイナリ（`.bin.br`）データ | 1.0.0-rc.11 |

## インストール（利用側）

```bash
# API + 公式データ（npm から import して渡す場合）
npm install @b4moss/jp-local-gov-id @b4moss/jp-local-gov-id-data

# API のみ（版付きインデックス URL から取得する場合）
npm install @b4moss/jp-local-gov-id
```

## 使い方

`createLocalGovClient` は async です。`data` または `url`（**index.json** の版付き URL）のいずれかが必須です。

初期化では `index.json` と都道府県（`.bin.br` を展開・デコード）のみを読み込み、市区町村は県単位で遅延ロードします。全国文字列検索はハイブリッド JLIX（ホットは 2-gram 地域ファイル、その他は 3-gram シャード）で候補を絞り、該当県の `.bin.br` だけを同時最大 6 件で取得します。

```ts
import { createLocalGovClient } from "@b4moss/jp-local-gov-id";
import dataset from "@b4moss/jp-local-gov-id-data";

const client = await createLocalGovClient({ data: dataset });

client.listPrefectures();
client.getPrefectureByCode("27"); // 大阪府
client.getMunicipalityCountByPrefecture("01"); // 同期・県別データ不要
client.getMunicipalityCountByPrefecture("北海道", { designatedCity: "city" });
client.getPrefectureCodeByName("大阪府"); // "27"
await client.listMunicipalitiesByPrefecture("13"); // 東京都の市区町村等
await client.getMunicipalityByCode("131016"); // 千代田区
await client.getByCode("131016");
await client.searchByText("中央", { prefecture: "01", target: "cities" });
await client.searchByText("ちよだ", { prefecture: "13", target: "cities" }); // カナ／ひらがな可
await client.getLocalGovCodeByName("千代田区"); // "131016"
```

版付きインデックス URL から取得する場合:

```ts
const client = await createLocalGovClient({
  url: "https://example.com/jp-local-gov-id-data/1.0.0-rc.11/index.json",
});
```

- `url` 指定時、取得したファイルを展開・デコードして localStorage にキャッシュします（既定 ON。キーは各ファイルの URL）。保存する文字列はデコード後オブジェクトの `JSON.stringify`（minify。空白なし）。**転送ペイロードの `.bin.br`（Brotli）とは別**で、localStorage に生バイトは置きません
- `cache: false` で無効化、`cacheTtlSeconds` で有効期限を秒単位で指定（既定 1 年 = `31536000`）
- 例外: **全国対象**の文字列検索で取得した県別データ、および JLIX（`search-ngrams/**`）は localStorage に書かず、メモリのみ保持します
- localStorage が無い環境（Node 等）ではキャッシュをスキップします
- 文字列検索はひらがな／全角カナを半角カナへ正規化します（`matchField` 既定: `"both"`）。正規化後長が 2 未満は空、2 はホット 2-gram のみ、3 以上は 2-gram と 3-gram をマージ
- スキーマ不一致・不正な JSON・不正なバイナリは `LocalGovSchemaError`、ネットワーク / HTTP エラーは通常の fetch エラーです
- クエリで見つからない・同名衝突の場合は `null` / `[]` を返します（throw しません）

### データ構成

全市区町村をまとめた単一ファイルは配布しません。データパッケージは **Brotli 圧縮バイナリ（`.bin.br`）** と、通常の JSON である `index.json` から構成されます。

| ファイル | 内容 |
|----------|------|
| `index.json` | パス・`schemaVersion`・`asOf` などの索引 — 通常の JSON |
| `prefectures.bin.br` | 都道府県のみ — Brotli バイナリ |
| `prefectures/{code}.bin.br` | 当該県の市区町村 — Brotli バイナリ |
| `search-ngrams/2gram/{region}.bin.br` | ホット団体の 2-gram 検索索引（JLIX・地域分割） |
| `search-ngrams/3gram/{shard}.bin.br` | コールド団体の 3-gram 検索索引（JLIX・3 シャード） |

`schemaVersion`（現行 `1`）はデコード後オブジェクトの形を表すもので、バイナリ形式自体のヘッダにある `version` とは別物です。中間 CSV / 非圧縮 `.bin` はリポジトリに置いていますが、npm には配布しません（npm は Brotli のみ）。

### 自前データ配信について

自前で配信する場合も、公式と同様に**バージョン付き URL**と同等の `index.json` + `.bin.br`（都道府県・県別・検索索引）構成で提供してください。可用性・CORS・内容の正しさ・URL 運用などについて、当パッケージ開発者は一切の責任を負いません。CORS は配信側で許可してください。

## コード形式

| 対象 | 形式 | 入力時の許容 |
|------|------|--------------|
| 都道府県 | 半角数字 2 桁 | 0 埋めの有無どちらも可（`"1"` / `"01"`） |
| 市区町村 | チェックデジット込みの 6 桁 | 6 桁を正式とする |

## 開発（モノレポ）

```bash
npm install
npm run generate   # Excel → CSV（リポジトリ） → .bin（レビュー）→ .bin.br（npm）+ ハイブリッド JLIX + index.json
npm test
npm run build
```

`develop` / `dev-*` 向け PR の作成・更新前に、ローカル CI を通してください。

```bash
npm run ci:local            # 推奨（nektos/act + Docker）
npm run ci:local:fallback   # Docker が無いときのみ
```

発火条件・スキップ・publish は [docs/ci-cd.ja.md](./docs/ci-cd.ja.md) を参照。

## バージョン方針

[Semantic Versioning](https://semver.org/) に従います。

| 変更の種類 | バージョン |
|------------|------------|
| バグ修正 | **patch** |
| 市町村合併などに伴うデータ更新 | データパッケージの **minor** |
| API の破壊的変更（ver 0.x） | **minor** |
| API の破壊的変更（ver 1.x 以降） | **major** |

## データについて

- 時点: 令和 6 年 1 月 1 日（R6.1.1）
- ソースファイル: `https://www.soumu.go.jp/denshijiti/code.html`
- 廃止・合併済みの団体は含みません（現行のみ）
- API パッケージにはデータを同梱しません（`@b4moss/jp-local-gov-id-data` または URL で渡してください）

詳細は [docs/main.md](./docs/main.md) を参照してください。

## ライセンス

MIT
