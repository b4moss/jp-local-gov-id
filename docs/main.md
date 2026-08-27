# 全国地方公共団体コードヘルパ 仕様書

## このプロジェクトについて

日本の地方自治体コードを扱うための仕組みです。配布は次の **2 パッケージ**に分けます。

| パッケージ | 内容 | パス |
|------------|------|------|
| JS API パッケージ | 検索・コード解決などの API | `packages/jp-local-gov-id`（npm: `@b4moss/jp-local-gov-id`） |
| データ JSON パッケージ | 分割された公式データ（後述） | `packages/jp-local-gov-id-data`（npm: `@b4moss/jp-local-gov-id-data`） |

## モチベーション

JavaScript で、現在の都道府県・市区町村の地方自治体コードを呼び出したい。  
データ JSON を API に同梱するとペイロードが重いため、API とデータを分離し、さらにデータを分割して必要な分だけ取得する。

## ID の定義

本パッケージにおける ID は、**全国地方公共団体コード**を指す。

### コード形式

| 対象 | 形式 | 入力時の許容 |
|------|------|--------------|
| 地方公共団体コード（エンティティの `code`） | 半角数字 6 桁 | 都道府県・市区町村とも 6 桁が正 |
| 都道府県コード（組織キー） | 半角数字 2 桁 | 0 埋めの有無どちらも許容（例: `"1"` / `"01"`）。ファイルパス・`index.prefectureCodes`・`getPrefectureCodeByName`・県指定フィルタで使用 |
| 市区町村コード | チェックデジット込みの 6 桁 | 地方公共団体コードと同形 |

`getByCode` / `getPrefectureByCode` は **2 桁（都道府県コード）と 6 桁（地方公共団体コード）の両方**で都道府県を解決できる。

## スコープ

| 項目 | 方針 |
|------|------|
| 全都道府県一覧 | あり（セレクトボックス等の用途を想定） |
| 全市区町村一覧 API | なし。県別取得・検索結果として返す |
| 全市区町村を1ファイルにまとめた配布 | **しない**（県別に分割する） |
| 名前検索 | 部分一致（`search`）。必要なら未ロードの県別データを取得してから検索 |
| 政令指定都市 | 市本体も返し、区も 1 地方公共団体として返す。`designatedCity` オプションで市のみ / 区のみ / 両方を選べる（既定: `"both"`）。東京特別区は対象外 |
| 政令市区の `name` | 元データどおり（例: `札幌市中央区`）。区名のみへの正規化はしない |
| カナ | `LocalGov` に半角カナを含める |
| 廃止・合併済みコード | 返さない（現行のみ） |
| 見つからない・同名衝突 | `null` または空配列を返す（throw しない） |
| 文字の正規化 | 当面は**そのまま比較**。将来、最低限の正規化を検討する |
| データ読み込み | **import したデータセット**または **インデックスの URL** のいずれかを必須とする（自動探索はしない） |

## データ構成

データパッケージは、次のファイル群で構成する。**市区町村全部入りの単一 JSON は置かない。**

| ファイル | 内容 |
|----------|------|
| `index.json` | 各 JSON へのパス・版・`schemaVersion` などの索引（上位層） |
| `prefectures.json` | 都道府県のみ（全都道府県） |
| `prefectures/{code}.json` | 当該都道府県配下の市区町村（市本体・区を含む）。`{code}` は 2 桁（例: `13.json`） |

### インデックス（`index.json`）の役割

- 公式・自前配信いずれでも、クライアントはまずインデックスを読む
- 都道府県ファイル・各県別ファイルのパス（相対または絶対）を解決する
- `schemaVersion` / データ時点（`asOf`）などを持つ

### 生成・配布

```text
resources/*.xlsx
  → scripts/generate
  → packages/jp-local-gov-id-data/
       index.json
       prefectures.json
       prefectures/01.json … 47.json 相当
```

## パッケージ構成と初期化

### 二系統

1. **JS API のみ** — クライアント生成とクエリ API
2. **データ JSON パッケージ** — 上記の分割データ。npm から渡すか、版付き URL（インデックス）で配信する

### 初期化（async）

`data`（インデックス相当のオブジェクト、またはデータセット）と `url`（**インデックス JSON の版付き URL**）はいずれか必須。両方ない場合は引数エラーとする。

初期化時に読み込むもの:

1. インデックス
2. `prefectures.json`（都道府県のみ）

県別の市区町村 JSON は、必要になった時点で遅延ロードする。

```ts
// 公式データパッケージから渡す（形は実装で確定。index + 解決手段）
import * as dataset from "@b4moss/jp-local-gov-id-data";
const client = await createLocalGovClient({ data: dataset });

// または版付きインデックス URL
const client = await createLocalGovClient({
  url: "https://example.com/jp-local-gov-id-data/0.3.2/index.json",
});

// キャッシュを無効化 / TTL を秒で指定（url モードのみ有効）
const clientNoCache = await createLocalGovClient({
  url: "https://example.com/jp-local-gov-id-data/0.3.2/index.json",
  cache: false,
});
const clientShortTtl = await createLocalGovClient({
  url: "https://example.com/jp-local-gov-id-data/0.3.2/index.json",
  cacheTtlSeconds: 3600, // 1 時間
});
```

### 遅延ロードと文字列検索

- 特定都道府県の市区町村が必要な API は、未ロードなら当該 `prefectures/{code}.json` を取得する
- **全国を対象とする文字列検索**（`searchByText` / `getLocalGovCodeByName` で都道府県に絞らない、かつ市区町村が対象に含まれる場合など）では、未ロードの県別 JSON をすべて取得してから検索する
- その際の並列度は **同時 6 件**とする（6 件ずつ並列 fetch）
- すでにメモリ上にある県別データは再取得しない
- `url` 経路で取得した各ファイルは、後述の localStorage キャッシュ対象とする（ただし全国検索で取得した県別 JSON は例外）

### スキーマ検証

- 各 JSON（index / prefectures / 県別）のスキーマ定義は **API 側**が持つ
- 読み込んだデータがスキーマ検証に失敗した場合はエラーとする
- JSON としてパースできない・形が不正な場合もスキーマエラーとして扱う

### URL 取得時のキャッシュ（localStorage）

- **`url` 起点で fetch した各ファイル**について、結果を localStorage に保存して再利用する（**既定: ON**）
- `createLocalGovClient` のオプションで制御する:
  - `cache?: boolean` — 既定 `true`。`false` で localStorage の読み書きを行わない
  - `cacheTtlSeconds?: number` — 有効期限（**秒**）。既定 `31536000`（1 年）。`cache: false` のときは無視
- 例外: **全国対象の文字列検索**で取得した県別 JSON（`prefectures/{code}.json`）は localStorage に書かず、**メモリのみ**保持する（`cache` の設定にかかわらず書き込みしない）
- `getByCode` / `listMunicipalitiesByPrefecture` / `getMunicipalityByCode` / 都道府県指定の検索で取得した県別 JSON は従来どおりキャッシュする（`cache: true` のとき）
- `data` を直接渡した場合はキャッシュしない（`cache` / `cacheTtlSeconds` を渡しても URL キャッシュには使わない）
- **キャッシュキーは版付き URL そのもの**とする（公式の利用方法）
- localStorage が使えない環境（Node 等）ではキャッシュをスキップしてよい
- 同一 URL の中身を後から書き換えた場合の整合は保証しない
- 既に localStorage にある県別 JSON は、全国検索時も読み取り再利用してよい（書き込みだけ抑止。`cache: false` のときは読み取りもしない）

### 公式 URL と自前データ

- 公式の利用方法は **バージョン付き URL**（例: パスに `0.3.2` を含める）。エントリは `index.json`
- 利用側が自前でデータを配信する場合も、**公式と同様にバージョン付き URL** と同等のファイル構成で提供すること
- 自前データ配信（可用性・CORS・内容の正しさ・URL 運用など）について、**当パッケージ開発者は一切の責任を負わない**
- CORS は配信側で許可する前提とし、本仕様ではこれ以上扱わない

### 取得失敗時

- ネットワークエラー・HTTP 404 等は、通常の fetch / HTTP エラーとして表面化する
- JSON 不正・スキーマ不一致はスキーマエラーとする

## 機能要件

- 初期化時に `data` または `url`（インデックス）を必須とすること
- 初期化時に都道府県データを読み込み、スキーマ検証すること
- 全都道府県一覧を取得できること
- 都道府県を指定したら、配下の市区町村情報（市本体・区を含む）が出力されること（未ロードなら当該県 JSON を取得）
- 都道府県を指定したら、コード（2 桁）が返されること
- コードを指定したら、都道府県や市区町村の情報が一意に出力されること（市区町村は先頭 2 桁から県を特定してロードしてよい）
- 名前の文字列検索は部分一致で候補一覧を返せること（対象は引数で選択）
- 全国対象の文字列検索では、未ロードの県別データを **同時 6 件**で並列取得してから検索すること
- 名前からコードを取る場合は、一意に決まるときのみ返すこと
- クエリ時、見つからない場合や同名で一意に決まらない場合は、`null` または空配列を返すこと（例外は投げない）

## API

市区町村データを必要としうる操作は **async** とする（遅延ロードのため）。

```ts
type Prefecture = {
  code: string                 // 地方公共団体コード（6 桁）。例: "130001"
  name: string                 // 例: "東京都"
  nameKana: string             // 半角カナ
  /** 都道府県レコードのみ */
  municipalityCounts?: {
    both: number
    city: number
    ward: number
  }
}

type Municipality = {
  code: string                 // 地方公共団体コード（6 桁）。例: "131016"
  name: string                 // 例: "千代田区" / "札幌市中央区"
  nameKana: string             // 半角カナ
  prefectureCode: string       // 所属都道府県コード（2 桁）。例: "13"
  prefectureName: string       // 例: "東京都"
  prefectureNameKana: string   // 半角カナ（例: "ﾄｳｷｮｳﾄ"）
}

type LocalGov = Prefecture | Municipality
// 都道府県は所属フィールドを持たない。市区町村のみ prefecture* を持つ。

type SearchTarget = "all" | "prefectures" | "cities"

/** 政令指定都市の市本体 / 行政区の出し分け（東京特別区は対象外） */
type DesignatedCityMode = "both" | "city" | "ward"
// both = 市本体+区（既定） / city = 市本体のみ / ward = 区のみ

type ListMunicipalitiesOptions = {
  designatedCity?: DesignatedCityMode  // 既定: "both"
}

type SearchOptions = {
  prefecture?: string
  target?: SearchTarget       // 既定: "all"
  matchField?: "name" | "nameKana" | "both"  // 既定: "both"
  designatedCity?: DesignatedCityMode        // 既定: "both"
}

type CreateLocalGovOptions =
  | {
      data: unknown
      url?: never
      cache?: boolean              // url モード用。data では無視（既定 true）
      cacheTtlSeconds?: number     // 秒。既定 31536000（1 年）
    }
  | {
      url: string
      data?: never
      cache?: boolean              // 既定: true
      cacheTtlSeconds?: number     // 秒。既定: 31536000（1 年）
    }

/** インデックス解決・都道府県ロード・スキーマ検証のうえクライアントを返す */
createLocalGovClient(options: CreateLocalGovOptions): Promise<LocalGovClient>

type LocalGovClient = {
  /** 同期可（初期化時にロード済み） */
  listPrefectures(): Prefecture[]
  getPrefectureByCode(code: string): Prefecture | null
  /** 都道府県名 → 都道府県コード（2 桁）。地方公共団体コードではない */
  getPrefectureCodeByName(name: string): string | null
  /**
   * 都道府県の municipalityCounts から件数を返す（同期・県別 JSON 不要）
   * pref はコードまたは名称。未知は null。designatedCity 既定 "both"
   */
  getMunicipalityCountByPrefecture(
    pref: string,
    options?: ListMunicipalitiesOptions,
  ): number | null

  /** 未ロードなら県別 JSON を取得してから返す */
  listMunicipalitiesByPrefecture(
    pref: string,
    options?: ListMunicipalitiesOptions,
  ): Promise<Municipality[]>
  getMunicipalityByCode(code: string): Promise<Municipality | null>
  getByCode(code: string): Promise<LocalGov | null>
  searchByText(text: string, options?: SearchOptions): Promise<LocalGov[]>
  /** 正式名称 → 地方公共団体コード（6 桁）。都道府県ヒット時も 6 桁 */
  getLocalGovCodeByName(name: string, options?: SearchOptions): Promise<string | null>
}
```

文字列検索は比較前にひらがな→カタカナ、全角カナ→半角カナへ正規化する。

### 利用例

```ts
const client = await createLocalGovClient({
  url: "https://.../0.3.2/index.json",
})

client.listPrefectures()
client.getPrefectureCodeByName("大阪府")
client.getPrefectureByCode("27")
client.getMunicipalityCountByPrefecture("01")
client.getMunicipalityCountByPrefecture("北海道", { designatedCity: "city" })

await client.listMunicipalitiesByPrefecture("大阪府")
await client.listMunicipalitiesByPrefecture("01", { designatedCity: "city" }) // 政令市本体のみ
await client.getMunicipalityByCode("271004")
await client.getByCode("271004")
await client.searchByText("堺") // 全国対象なら未ロード県を 6 並列で取得してから検索
await client.searchByText("中央", { prefecture: "01", target: "cities" })
await client.searchByText("札幌", { prefecture: "01", target: "cities", designatedCity: "ward" })
await client.searchByText("東京", { target: "prefectures" }) // 都道府県のみなら追加 fetch 不要
await client.searchByText("ちよだ", { target: "cities" }) // カナ／ひらがな可
await client.getLocalGovCodeByName("千代田区")
await client.getLocalGovCodeByName("札幌市", { designatedCity: "city" })
```

## 情報のソース

- 公的に配布されているエクセルデータを `resources/` 配下に配置する
- 開発時に、パースするスクリプトを `scripts/` 配下に作成し、分割 JSON を生成する
- 生成物は **データ JSON パッケージ**として配布する（API パッケージには同梱しない）
- 市町村合併などがあるときは、ソースを更新し、スクリプトを再度走らせ、**データパッケージを minor 更新**する
- 配布物に、パーススクリプト（`scripts/`）とエクセルファイル（`resources/`）は含まない
- ソースデータの再配布・利用は確認済み。パッケージが提供するのは元データと同じ内容を別形式（JSON）にしたものであり、元のエクセル等は配信しない

### 採用データ

| 項目 | 内容 |
|------|------|
| ファイル | `resources/000925835.xlsx` |
| 時点 | 令和6年1月1日（シート名: R6.1.1） |
| シート1 | `R6.1.1現在の団体` — 都道府県47 + 市区町村等（東京23区を含む。政令市区は含まない） |
| シート2 | `R6.1.1政令指定都市` — 政令市本体20 + 行政区171 |
| 団体コード | いずれもチェックデジット込みの **6桁** |

### ディレクトリ構成（モノレポ）

本リポジトリは **npm workspaces** によるモノレポとする。ルートの `package.json` は `private` とし、公開しない。

```text
jp-local-gov-id/
├── package.json                 # workspaces ルート（private）
├── README.md
├── docs/
├── resources/                   # 元 Excel（共有素材・非配布）
├── scripts/                     # 生成ツール（private・Node.js 専用）
└── packages/
    ├── jp-local-gov-id/         # JS API（公開）
    └── jp-local-gov-id-data/    # 分割データ JSON（公開）
         ├── index.json
         ├── prefectures.json
         └── prefectures/
              ├── 01.json
              └── …
```

| パス | 内容 | 配布 |
|------|------|------|
| `packages/jp-local-gov-id/` | JS API 本体 | API パッケージとして npm 公開 |
| `packages/jp-local-gov-id-data/` | `index` / `prefectures` / 県別 JSON | データパッケージとして npm 公開 |
| `resources/` | 元ソースのエクセルデータ | 含めない |
| `scripts/` | Excel → JSON のパーススクリプト | 含めない |
| `docs/` | 仕様・ロードマップ | 含めない |

ルート `package.json` の workspaces:

```json
{
  "private": true,
  "workspaces": ["packages/*", "scripts"]
}
```

生成の流れ: `resources/*.xlsx` → `scripts/generate` → `packages/jp-local-gov-id-data/` 配下の分割 JSON

### パース時の注意点

1. **2シートのマージ** — シート1をベースに、シート2の行政区（シート1に無い171件）を追加する。政令市本体20件は両シートに重複するため、二重登録しない
2. **都道府県コードの桁変換** — 元データは都道府県も6桁（例: `010006`）。API の都道府県コードは先頭2桁（例: `"01"`）に変換する。入力時の0埋め有無の許容は別途正規化する
3. **区の表記** — 特別区は `中央区`、政令市の区は `札幌市中央区` のように市名付き。**元データどおり** `name` に格納する
4. **カナは半角** — 元データのカナ列は半角カナのまま `nameKana` / `prefectureNameKana` に格納する
5. **空列** — 末尾の未使用列は無視する
6. **分割出力** — 都道府県一覧と県別市区町村に分けて出力する。全市区町村単一ファイルは出力しない
7. **鮮度** — 本ファイルは R6.1.1 時点。以降の合併等があれば `resources/` を更新し、スクリプトを再実行してデータパッケージを **minor** リリースする

## 非機能要件

### ランタイム

- 開発・ビルドは Node.js を想定する
- 利用の主対象はブラウザとする
- Node.js での利用は妨げないが、動作保証の対象外とする

### 配布形式

- ESM 前提とする
- TypeScript の型定義を同梱して配布する
- API パッケージとデータ JSON パッケージを分離して配布する

### 開発環境・ビルド

- リポジトリは npm workspaces のモノレポとする
- API パッケージ（`packages/jp-local-gov-id`）の開発は Vite + TypeScript（ライブラリモード）
- パーススクリプト（`scripts/`）は独自の `package.json` を持ち、Node.js で実行する

### パッケージサイズ・取得

- API パッケージはデータ JSON を同梱せず、小さく保つ
- 初期化では都道府県データまでを読み、市区町村は県単位で遅延取得する
- 全国文字列検索時の未ロード県取得は、同時 **6** 並列とする

### バージョン方針（semver）

- 基本は [Semantic Versioning](https://semver.org/) に従う
- バグ修正は **patch** とする
- 市町村合併などに伴うデータ更新は、データパッケージの **minor** とする
- ver1.x以降、API の破壊的変更がある場合は **major** とする
  - ver0.x以内は、破壊的変更があっても **minor** とする

## 将来検討

- 文字の正規化（全角半角・「ヶ/ケ」・旧字体など）。当面は正規化なしのまま比較する
- データソースの取得元 URL・更新頻度のドキュメント化（当面は未記載のまま進める）
- 公式の版付き配信 URL の具体

-----

以上
