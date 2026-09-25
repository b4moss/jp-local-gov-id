# テスト仕様書: 総務省 Excel ソースハッシュ監視スクリプト（#66）

対象マイルストーン: `app-v1.0.0-rc.11`  
関連: [main.md](./main.md) / [ci-cd.ja.md](./ci-cd.ja.md) / Issue #66  
作業ブランチ: `cursor/issue-66-source-hash-test-spec-b22c`  
想定実装: `scripts/check-source-hash.ts`（ルート `npm run check:source-hash`）

## 1. 目的

総務省公開 Excel の取得・SHA-256 比較・ステータス JSON 出力の契約を固定する。

- 監視 URL は決め打ち: `https://www.soumu.go.jp/main_content/000925835.xlsx`
- 比較基準はリポジトリ内 `resources/000925835.xlsx` の SHA-256
- 結果は `status` 付き JSON（stdout および任意の `--out`）
- **生成物**（CSV / `.bin` / `.bin.br`）のハッシュは対象外
- Excel の自動差し替え・`generate` 実行は対象外（本スクリプトは検知のみ）

GitHub Actions・サイト UI は本仕様の **直接テスト対象外**（スクリプトが返す JSON / 終了コードを前提に実装する）。

## 2. 用語

| 用語 | 意味 |
|------|------|
| ローカルソース | `resources/000925835.xlsx` |
| 期待ハッシュ | ローカルソースの SHA-256（小文字 hex） |
| リモートハッシュ | 決め打ち URL から取得したバイト列の SHA-256（小文字 hex） |
| ステータス JSON | 下記 §3 のオブジェクト |
| `ok` | 取得成功かつ期待ハッシュ === リモートハッシュ |
| `fetch_failed` | リモート取得失敗（HTTP エラー・ネットワークエラー等） |
| `hash_mismatch` | 取得成功だがハッシュ不一致 |

## 3. ステータス JSON 契約

必須フィールドと型:

| フィールド | 型 | 制約 |
|------------|-----|------|
| `sourceUrl` | string | 決め打ち URL と完全一致 |
| `localPath` | string | `"resources/000925835.xlsx"`（リポジトリルート相対） |
| `checkedAt` | string | ISO 8601（UTC 推奨、`Z` またはオフセット付き）。実行時刻 |
| `expectedSha256` | string | `/^[0-9a-f]{64}$/`。ローカルソースから計算 |
| `remoteSha256` | string \| `null` | 成功時は `/^[0-9a-f]{64}$/`。`fetch_failed` 時は `null` |
| `status` | string | `"ok"` \| `"fetch_failed"` \| `"hash_mismatch"` のみ |

任意（実装してよいが必須ではない）:

| フィールド | 型 | 意味 |
|------------|-----|------|
| `error` | string | `fetch_failed` 時の概要（HTTP ステータスや短いメッセージ） |

例（`ok`）:

```json
{
  "sourceUrl": "https://www.soumu.go.jp/main_content/000925835.xlsx",
  "localPath": "resources/000925835.xlsx",
  "checkedAt": "2026-08-29T12:00:00.000Z",
  "expectedSha256": "7d04c8a7f6a6e76a7823a0414a8422bf2b26bb6070766971df76eab58ea6ff78",
  "remoteSha256": "7d04c8a7f6a6e76a7823a0414a8422bf2b26bb6070766971df76eab58ea6ff78",
  "status": "ok"
}
```

（`expectedSha256` の具体値は実装時点の `resources/000925835.xlsx` に依存。上表の値は仕様執筆時点の参考。）

## 4. テスト方針

実装先の目安:

- `scripts/check-source-hash.test.ts`（または `scripts/**/*.test.ts`）
- テストランナーはリポジトリ既存（Node test / Vitest 等）に合わせる
- **リモート HTTP はモック**する（CI が総務省に依存しない）
- ローカルファイルはフィクスチャ（一時ディレクトリの小さなバイト列）を使い、実 Excel への依存を避ける

注入ポイント（実装が満たすべきテスト容易性）:

- ローカルファイルパス（デフォルトは `resources/000925835.xlsx`）
- 取得 URL（デフォルトは決め打ち URL）
- `fetch` 相当（または HTTP 取得関数）
- 現在時刻（`checkedAt` の決定性。省略時は実時刻でよいが、テストでは固定可能であること）

CLI は上記コア関数を呼ぶ薄いラッパでよい。

## 5. コアロジックケース（TC-C）

### TC-C01: 取得成功・ハッシュ一致 → `ok`

- **前提**: ローカルバイト列 `A`、リモート応答 body も `A`、HTTP 200
- **操作**: チェック実行
- **期待**: `status === "ok"`
- **期待**: `expectedSha256 === remoteSha256`（いずれも `sha256(A)` の小文字 hex）
- **期待**: `sourceUrl` / `localPath` が契約どおり
- **期待**: 終了コード `0`（CLI 経由時）

### TC-C02: 取得成功・ハッシュ不一致 → `hash_mismatch`

- **前提**: ローカル `A`、リモート body `B`（`A !== B`）、HTTP 200
- **操作**: チェック実行
- **期待**: `status === "hash_mismatch"`
- **期待**: `expectedSha256 === sha256(A)`、`remoteSha256 === sha256(B)`、両者は異なる
- **期待**: 終了コード非 0（CLI 経由時。推奨 `1`）

### TC-C03: HTTP エラー → `fetch_failed`

- **前提**: リモートが 404（または 5xx）を返す
- **操作**: チェック実行
- **期待**: `status === "fetch_failed"`
- **期待**: `remoteSha256 === null`
- **期待**: `expectedSha256` はローカルから計算済み（ローカルが読める場合）
- **期待**: 終了コード非 0

### TC-C04: ネットワーク失敗 → `fetch_failed`

- **前提**: `fetch` が接続エラー等で reject
- **操作**: チェック実行
- **期待**: `status === "fetch_failed"`、`remoteSha256 === null`
- **期待**: プロセスが未捕捉例外で落ちない（JSON を出し終了コード非 0）

### TC-C05: 空ボディもハッシュ対象

- **前提**: HTTP 200、body が空（0 バイト）、ローカルも空
- **期待**: `status === "ok"`、ハッシュは空入力の SHA-256  
  （`e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855`）

### TC-C06: ハッシュ表記は小文字 hex 64 桁

- **前提**: 任意の一致ケース
- **期待**: `expectedSha256` / `remoteSha256` が `/^[0-9a-f]{64}$/`（大文字・プレフィックス `sha256:` なし）

### TC-C07: `checkedAt` が実行時刻を表す

- **前提**: 時刻を固定注入（例: `2026-08-29T12:00:00.000Z`）
- **期待**: `checkedAt` がその値（または同等の ISO 文字列）
- **期待**: 注入なしの場合は実行前後の妥当な時刻範囲に入る

### TC-C08: 決め打ち URL がデフォルト

- **操作**: URL 上書きなしで実行（モック fetch の引数を検証）
- **期待**: リクエスト URL が  
  `https://www.soumu.go.jp/main_content/000925835.xlsx`  
  と一致する
- **期待**: ステータス JSON の `sourceUrl` も同一

### TC-C09: ローカルファイル欠落

- **前提**: ローカルパスが存在しない
- **操作**: チェック実行
- **期待**: ステータス JSON を無理に `ok` にしない
- **期待**: 明確に失敗（例外または専用失敗。終了コード非 0）
- **期待**: リモート取得の成否に関わらず「ローカル基準が無い」状態を成功扱いにしない

### TC-C10: ローカルソースを書き換えない

- **前提**: ローカルフィクスチャの内容・mtime を記録
- **操作**: 一致 / 不一致 / 取得失敗の各パスを実行
- **期待**: ローカルファイルのバイト列が不変

## 6. CLI・出力ケース（TC-CLI）

実装先の目安: CLI 統合テスト、またはコア + ファイル I/O の薄いテスト。

### TC-CLI01: stdout に JSON

- **操作**: `--out` なしで実行（モックで `ok`）
- **期待**: 標準出力が §3 の JSON 1 オブジェクトとして parse 可能
- **期待**: 余計なログを stdout に混ぜない（ログは stderr 可）

### TC-CLI02: `--out` に書き出す

- **操作**: `--out <tmpdir>/source-monitor.json` で実行
- **期待**: 指定パスに §3 準拠 JSON が書かれる
- **期待**: 親ディレクトリが既存なら上書き更新できる

### TC-CLI03: `--out` 先の親欠落

- **前提**: 親ディレクトリが存在しないパス
- **期待**: 失敗するか、実装が親を作成するかのいずれかを文書化し、テストで固定する  
  （推奨: 親が無ければエラー終了。暗黙 mkdir しない）

### TC-CLI04: npm script

- **期待**: ルート `package.json` に `check:source-hash` がある
- **期待**: `npm run check:source-hash -- --out <path>` で引数がスクリプトに渡る

### TC-CLI05: 終了コードと status の対応

| `status` | 終了コード |
|----------|------------|
| `ok` | `0` |
| `hash_mismatch` | 非 0 |
| `fetch_failed` | 非 0 |
| ローカル欠落等の実行不能 | 非 0 |

- **期待**: GHA が「非 ok なら job failure」にできるように、CLI 終了コードが上表と一致する

## 7. 非対象（明示）

次は本仕様書のテストケースに含めない（別タスク / 手動検証）。

- `monitor-source-hash.yml` の cron・bot コミット・Issue 起票
- サイト `SourceMonitorStatus.vue` の表示文言
- 生成物ハッシュ
- 実ネット越しの総務省到達性（フレーク回避のため CI ではモック必須）

手動スモーク（実装後・任意）:

- 実 URL に対する `npm run check:source-hash` が現行 `resources/000925835.xlsx` で `ok` になること

## 8. 受け入れ条件（スクリプト）

1. TC-C01〜C10 および TC-CLI01〜05 を自動テストでカバーする
2. デフォルト URL / デフォルトローカルパスが Issue #66 の決め打ちと一致する
3. 出力 JSON が §3 を満たし、サイト・GHA が `status` だけで表示／失敗分岐できる
4. CI 上、テスト実行が外部 HTTP に依存しない
