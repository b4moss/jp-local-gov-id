# CI / CD

GitHub Actions の発火条件、PR 前のローカル必須ゲート、npm publish と CI 履歴の関係、ドキュメントサイトの公開手順をまとめます。

## ローカルゲート（アプリ PR 前必須）

`develop` / `dev-*` 向けの PR を作成・更新する前に、**`act` の成功を必須**とします（人間・Cloud Agent 共通）。

```bash
# 推奨（Docker + nektos/act が必要）
npm run ci:local

# 同等
act pull_request -W .github/workflows/ci.yml
```

既定は [`.actrc`](../.actrc) です。`act` 実行時はゲートが API スキップせず Test/Build を必ず実行します（`ACT=true`）。Codecov は `ACT` 時にスキップされます。

Docker が無い環境（一部の Cloud Agent など）では次の代替を使えます。ただし **可能な環境では act を正**とします。

```bash
npm run ci:local:fallback   # npm ci && npm test && npm run build
```

ゲート失敗のまま PR しないでください。

### エージェント向け（アプリ / ライブラリ）

1. `npm run ci:local` を実行（Docker が無いときだけ `ci:local:fallback`）
2. 非 0 なら修正して再実行。PR 作成ツールはまだ呼ばない
3. 成功後に PR を作成・更新する

## アプリ CI（`.github/workflows/ci.yml`）

| 項目 | ルール |
|------|--------|
| トリガ | base が `develop` または `dev-*` の `pull_request` |
| 発火しない例 | 任意ブランチへの push、`main` / `release` / `doc-site` などへの PR |
| 重いジョブのスキップ | 同一 head SHA に成功済みの `CI` ワークフローがある |
| docs のみ | `docs/**`・`site/content/**`・`*.md` 等のみ → GitHub 上は Test/Build スキップ。ローカル act は原則フル実行 |
| 並行 | `Gate` の後に `Test` と `Build` を並行 |
| required check 名 | 集約ジョブ **`Test & Build`**（branch protection 互換） |

## Docs CI（`.github/workflows/ci-docs.yml`）

| 項目 | ルール |
|------|--------|
| トリガ | base が `doc-site` の `pull_request` |
| ジョブ | **`Docs Build`**: `npm ci` + `npm run build:site` |
| 対象外 | アプリの `npm test`、アプリ単体の検証、およびアプリ CI の成否 — **`doc-site` へのマージ判定では無視** |

### PR の向け先

| 変更の種類 | PR 先 |
|------------|--------|
| ドキュメント / サイト（`site/**` など） | **`doc-site`** |
| ライブラリ / データ / アプリ用スクリプト | 従来どおり `develop` または `dev-*` |

Playground が参照するライブラリを、すでに `main` / `release` に入った内容へ追従させたいときだけ、そのブランチを `doc-site` に取り込む。アプリ CI の成否はマージ条件にしない。

## Docs デプロイ（`.github/workflows/deploy-docs.yml`）

| 項目 | ルール |
|------|--------|
| トリガ | **`doc-site`** への `push`（通常はマージ後） |
| ビルド | `npm run build:site` → `site/.output/public` |
| 公開 | **`gh-pages`** ブランチへ orphan force push |
| 独立 | アプリ CI、`data-v*` / `app-v*` の npm リリース、旧 `site-v*` タグ（廃止）とは無関係 |

**人手のリポジトリ設定:** GitHub Pages → Source = **Deploy from a branch** → `gh-pages` / `(root)`。カスタムドメイン `jplocalgov.oss.b4m.jp` は `site/public/CNAME` で維持する。

## ソース Excel 監視（`.github/workflows/monitor-source-hash.yml`）

| 項目 | ルール |
|------|--------|
| トリガ | 週次 cron（月曜 01:30 UTC）+ `workflow_dispatch` |
| 内容 | 総務省 Excel を取得し `resources/000925835.xlsx` と SHA-256 比較 → `site/public/source-monitor.json` を更新コミット |
| 異常時 | `source-monitor` ラベルの Issue 起票／コメント、job failure |
| 詳細 | [test-spec-66-source-hash.md](./test-spec-66-source-hash.md) / Issue #66 |

## CD — npm publish（`.github/workflows/publish.yml`）

| 項目 | ルール |
|------|--------|
| トリガ | `data-v*` / `app-v*` の GitHub Release **published**、またはタグ指定の `workflow_dispatch` |
| 祖先チェック | タグのコミットが `origin/release` の祖先であること |
| 検証スキップ | その SHA に CI success があれば Test/Build 省略。pack + provenance publish は常に実行 |
| 履歴なし | Test + Build のあと publish |
| dispatch | `force_test` で常に Test+Build 可能 |

`data-v*` / `app-v*` タグは **`release` ブランチから**打つ。`release-on-tag.yml` はこれらのタグのみ自動 Release 作成。

## 流れ

```text
# アプリ / ライブラリ
ローカル変更 → npm run ci:local（必須）
            → develop / dev-* へ PR
            → CI Gate → Test ‖ Build → "Test & Build"
release 上のタグ → Release → Publish（CI 再利用 or 再検証）→ npm

# ドキュメントサイト
サイト変更 → doc-site へ PR
          → Docs CI（"Docs Build"）
          → doc-site へマージ → Deploy Docs → gh-pages → GitHub Pages
```
