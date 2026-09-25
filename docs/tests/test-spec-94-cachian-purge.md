# テスト仕様書: キャッシュ API の cachian 外出しと purgeCache（#94）

対象マイルストーン: `v1.1.0`  
関連: Issue #94 / 作業ブランチ `cursor/cachian-cache-purge-6db9` / 統合先 `dev-v1.1.0`  
想定実装:

- 依存: `@b4moss/cachian@0.4.0`
- 取り込み範囲: `localStorageDriver` + `get` / `set` / `purge` のみ
- 内部配線: [`packages/jp-local-gov-id/src/cache.ts`](../packages/jp-local-gov-id/src/cache.ts) / [`create.ts`](../packages/jp-local-gov-id/src/create.ts) / [`api.ts`](../packages/jp-local-gov-id/src/api.ts) / [`types.ts`](../packages/jp-local-gov-id/src/types.ts)
- 公開: `LocalGovClient.purgeCache(options)`、`CachePurgeOptions` の型 re-export

## 1. 目的

自前 localStorage キャッシュ実装を **`@b4moss/cachian` に置き換え**、利用者が明示的にキャッシュを消せる **`purgeCache` API** を固定する。

- url 経路の読み書きは従来どおり **get / set のみ**（自動 purge なし）
- IndexedDB および `remove` / `clear` / `update` / `upsert` / `has` は **取り込まない**
- 自前の TTL 切れ判定・削除は **破棄**する。TTL 切れの高度な振る舞いは cachian 側の今後に委ね、本パッケージでは保証しない（破壊的変更として許容）
- `purge({ all: true })` がアプリ全体の localStorage を消さないよう、物理キーに **`keyPrefix`** を付ける

## 2. 用語

| 用語 | 意味 |
|------|------|
| cachian | `@b4moss/cachian@0.4.0`。browser cache helper |
| 論理キー | キャッシュの論理キー。現行どおり **絶対 URL 文字列**（index / prefectures / 市区町村ファイル URL） |
| 物理キー | localStorage 上の実キー。`keyPrefix + 論理キー` |
| keyPrefix | 固定値 `jp-local-gov-id:` |
| cache インスタンス | `createLocalGovClient`（url モード）内で作る `createCache(...)` の1インスタンス。`fetchAndCache` と `purgeCache` が共有 |
| `purgeCache` | `LocalGovClient` のメソッド。引数は cachian の `CachePurgeOptions` |
| minify キャッシュ | デコード後オブジェクトを JSON 文字列として保存する現行意味（Brotli 生バイトは保存しない）。#73 の定義を踏襲 |

対象境界:

| 含む | 含まない |
|------|----------|
| `@b4moss/jp-local-gov-id` の url モード localStorage キャッシュ | メモリ上の検索パーティションキャッシュ（JLIX） |
| `LocalGovClient.purgeCache` | 独立関数としての purge export |
| `cache` / `cacheTtlSeconds` オプションの継続 | IndexedDB ドライバ |
| | cachian 本体の TTL 切れ実装の追加・改修 |

## 3. 依存・配線ケース（TC-D）

実装先の目安: `package.json` 契約確認、または薄いユニット / ビルドスモーク。

### TC-D01: 依存バージョン

- **期待**: `packages/jp-local-gov-id` の `dependencies` に `"@b4moss/cachian": "0.4.0"` がある
- **期待**: ルート `package-lock.json` が当該バージョンに解決する

### TC-D02: 取り込み範囲

- **期待**: ソースが import するのは次に限る
  - `@b4moss/cachian`（`createCache` および必要な型）
  - `@b4moss/cachian/drivers/localStorage`
  - `@b4moss/cachian/methods/get`
  - `@b4moss/cachian/methods/set`
  - `@b4moss/cachian/methods/purge`
- **期待**: `drivers/indexedDB` および他 methods サブパスを import しない

### TC-D03: クライアント単位のインスタンス共有

- **前提**: url モードで `createLocalGovClient` を実行
- **期待**: 同一クライアントの fetch 経路（get/set）と `purgeCache` が同じ cache インスタンス（同じ prefix / enabled / 既定 TTL）を使う
- **期待**: 別クライアントを別オプション（例: `cache: false` と `cache: true`）で作った場合、互いの enabled 状態を汚染しない

### TC-D04: data モードではキャッシュしない

- **前提**: `{ data }` でクライアント作成
- **期待**: localStorage への書き込みが起きない
- **期待**: `purgeCache(...)` は例外を投げず no-op（Promise が resolve）

## 4. get / set ケース（TC-G）— 現行経路

実装先の目安: `cache.test.ts` / `api.test.ts`（url + cache）。

### TC-G01: ミス後にフェッチして set

- **前提**: `cache: true`、localStorage 利用可、対象 URL のキャッシュなし
- **操作**: url モードでクライアント作成（または市町村ファイルを読む API を呼ぶ）
- **期待**: ネットワーク（またはフィクスチャ fetch）が走る
- **期待**: 物理キー `jp-local-gov-id:` + 絶対 URL にエントリが書かれる
- **期待**: エントリはデコード後オブジェクト相当（minify JSON）。`.bin.br` 生バイトではない

### TC-G02: ヒット時は再フェッチしない

- **前提**: TC-G01 相当でキャッシュ済み
- **操作**: 同じ url で再度 `createLocalGovClient`（または同一ファイルを再読込）
- **期待**: 当該 URL の fetch 回数が増えない（キャッシュから復元）
- **期待**: 公開 API の結果はスキーマ検証後の正当なデータ

### TC-G03: `cache: false` で読み書きしない

- **前提**: `cache: false`
- **操作**: クライアント作成 → 再度作成
- **期待**: localStorage に本パッケージ prefix のキーが増えない
- **期待**: 毎回 fetch する

### TC-G04: `cacheTtlSeconds` を set に渡す

- **前提**: `cacheTtlSeconds: 60` など有限の非負値
- **操作**: url モードで書き込み発生
- **期待**: 保存エントリの `expiresAt` が「書き込み時刻 + TTL 秒」付近になる（cachian の set 契約）
- **期待**: 不正値（負数・非有限）は作成時に TypeError（現行メッセージ意味を維持。`cacheTtlSeconds` を含む）

### TC-G05: 全国検索・JLIX は localStorage しない

- **前提**: #63 / #73 の既存契約
- **期待**: 全国市区町村検索で読む県 `.bin.br`（persist しない経路）および JLIX（`search-ngrams/**`）は localStorage に書かない
- **期待**: 本変更でこの契約を壊さない

### TC-G06: 環境不可時は静かな miss / no-op

- **前提**: `localStorage` 未定義、またはアクセスが throw
- **操作**: get 相当（クライアント作成）/ set 相当
- **期待**: 例外で落とさない（cachian の `CachianEnvironmentError` を利用者に漏らさない）
- **期待**: キャッシュなしとしてフェッチ経路へ進める

### TC-G07: 書き込み失敗（quota 等）を握りつぶす

- **前提**: `setItem` が throw する Storage
- **操作**: キャッシュ書き込み発生
- **期待**: 利用者向け例外にしない（現行踏襲）

## 5. キー・エントリ形ケース（TC-K）

### TC-K01: keyPrefix

- **期待**: 物理キーは必ず `jp-local-gov-id:` で始まる
- **期待**: 論理キー（API / purge の `keys`）は **prefix なしの絶対 URL**
- **期待**: prefix なしの旧キー（破壊的変更前の URL 直置き）は読まれない（ミス扱い・再フェッチでよい）

### TC-K02: エントリ形

- **期待**: localStorage 上の値は cachian エントリ（少なくとも `expiresAt` と `data`）
- **期待**: 新規 `set` では `createdAt` が付く（cachian 0.4.0 契約）
- **期待**: 不正 JSON / エントリ形でない値は miss として扱われ、可能なら当該物理キーを除去（cachian / ドライバ任せでよい）

### TC-K03: 自前 TTL 切れテストを置かない

- **期待**: 本パッケージのテストに「時間を進めて get が null になりキーが消える」といった **自前 TTL 切れの仕様固定**を新規・継続で置かない
- **理由**: TTL 切れ処理は cachian 側の今後に委ねる方針のため。本パッケージは set 時に TTL を渡すことと、オプション検証のみを固定する
- **許容**: cachian が get 時に期限切れを miss にする実装であっても、それを本リポジトリの受け入れ条件としては必須にしない（将来変更に追従）

## 6. purgeCache ケース（TC-P）

実装先の目安: `api.test.ts`（クライアントメソッド）。型は `CachePurgeOptions`。

### TC-P01: 公開面

- **期待**: `LocalGovClient` に `purgeCache(options: CachePurgeOptions): Promise<void>` がある
- **期待**: パッケージの公開型として `CachePurgeOptions` を利用者が import できる（cachian からの re-export 可）
- **期待**: 独立関数（例: `purgeLocalGovCache`）は **export しない**

### TC-P02: `purgeCache({ all: true })`

- **前提**: url モード、`cache: true`、複数 URL がキャッシュ済み。加えて prefix 外の localStorage キーが存在する
- **操作**: `await client.purgeCache({ all: true })`
- **期待**: `jp-local-gov-id:` 配下のキーがすべて消える
- **期待**: prefix 外のキーは残る（他ライブラリ・アプリデータを消さない）

### TC-P03: `purgeCache({ keys })`

- **前提**: URL A / B がキャッシュ済み
- **操作**: `await client.purgeCache({ keys: [A] })`（A は論理キー＝絶対 URL）
- **期待**: A のみ消え、B は残る
- **期待**: その後 A を要すると再フェッチ、B はヒットし得る

### TC-P04: `olderThan` / `createdBefore` / `createdAfter`

- **前提**: 新規 set 済みエントリ（`createdAt` あり）
- **操作**: cachian が受け付ける時間条件で `purgeCache` を呼ぶ
- **期待**: 条件に合うエントリだけ削除される（詳細閾値は cachian 契約に委譲。本パッケージは委譲呼び出しが届くことを固定）
- **期待**: `olderThan` と `createdBefore` / `createdAfter` の混在は TypeError（cachian と同じ）

### TC-P05: `cache: false` のクライアント

- **前提**: `cache: false` の url クライアント（または同等の enabled=false インスタンス）
- **操作**: `purgeCache({ all: true })` など
- **期待**: 例外なしで no-op。既存の他キー（別クライアントが書いたもの含む）を誤って消さない

### TC-P06: 内部経路は purge を自動呼び出ししない

- **操作**: 通常の create / list / getByCode / search のみ
- **期待**: `purge` が副作用として走らない（キャッシュが勝手に全消しされない）

## 7. 回帰・公開契約ケース（TC-R）

### TC-R01: 既存公開オプション

- **期待**: `cache?: boolean`（既定 `true`）、`cacheTtlSeconds?: number`（既定 `31536000`）が残る
- **期待**: `DEFAULT_CACHE_TTL_SECONDS` / deprecated `CACHE_TTL_MS` の export が残る

### TC-R02: メソッド一覧への追加のみ

- **期待**: 既存 `LocalGovClient` メソッドの同期/非同期・戻り値意味を変えない
- **期待**: 追加は `purgeCache` のみ（本 Issue 範囲）

### TC-R03: ドキュメント記載

- **期待**: 次に依存・prefix・`purgeCache`・破壊的変更（旧キー無効、TTL 切れは cachian 委譲）が書かれる
  - `packages/jp-local-gov-id/README.md` / `README_ja.md`
  - `site/content/*/api.md`（および必要なら usage）
  - `docs/logics.md` / `docs/main.md`

## 8. 非対象（明示）

- cachian リポジトリ側への TTL 切れ機能追加
- IndexedDB バックエンド
- `remove` / `clear` を本パッケージ公開 API として出すこと（必要なら `purge` の options で表現）
- キャッシュ値の追加圧縮（Brotli 生保存など）。minify JSON の意味は #73 のまま
- SSR 向けの永続キャッシュ代替ストレージ

## 9. 破壊的変更チェックリスト（受け入れ時に確認）

| 項目 | 受け入れ |
|------|----------|
| 旧物理キー（prefix なし URL）が読めない | 再フェッチされれば合格 |
| 自前 TTL 切れ TC の削除または無効化 | 本仕様 TC-K03 に合致すれば合格 |
| エントリに `createdAt` が付く | cachian 形式で合格 |
| `purgeCache` 追加 | TC-P を満たせば合格 |

## 10. 実装マッピング（目安）

| ID | 主な実装 / テストファイル |
|----|---------------------------|
| TC-D* | `package.json`、`create.ts`、`cache.ts` |
| TC-G* | `cache.test.ts`、`api.test.ts` |
| TC-K* | `cache.test.ts` |
| TC-P* | `api.test.ts`、`types.ts`、`index.ts` |
| TC-R* | `index.ts`、README、site、`docs/logics.md` |
