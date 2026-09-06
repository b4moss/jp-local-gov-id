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
| トリガ | base が `develop` または `dev-*` の `pull_request`、および **`main` / `release` への `push`** |
| 発火しない例 | `develop` への push、任意ブランチへの push、`main` / `release` / `doc-site` などへの PR |
| 重いジョブのスキップ | 同一 head SHA に成功済みの `CI` ワークフローがある、または docs/site のみの変更（**PR と push の両方**） |
| docs/site のみ | `docs/**`・`site/**`・`*.md`・docs 系 deploy ワークフロー等のみ → GitHub 上は Test/Build スキップ（`main` / `release` push も含む）。ローカル act は原則フル実行 |
| ジョブ | `Gate` のあと **`Test & Build` 単一ジョブ**（`npm ci` 1回 → test → build）。site ワークスペースは入れない |
| required check 名 | **`Test & Build`**（重い処理をスキップしてもジョブ自体は常に成功/失敗を報告） |
| `main` push の理由 | Codecov default branch の coverage 更新（#121）。コード push ごとにアプリ CI は **1回**。docs/site のみの push は重い処理をスキップ |
| `release` push の理由 | release 由来タグ SHA に CI 履歴を付け、publish の Test スキップを効かせる |
| 対象外 | GitHub **CodeQL** default setup（`dynamic/github-code-scanning/codeql`）は別ワークフローで、`main` push 時に併せて動くことがある |

## Docs CI（`.github/workflows/ci-docs.yml`）

| 項目 | ルール |
|------|--------|
| トリガ | base が `doc-site` の `pull_request` |
| 重いジョブのスキップ | **コンテンツのみ**の変更 → サイトビルドをスキップ（チェック自体は成功扱い） |
| コンテンツのみ | `docs/**`・`site/content/**`・`site/public/**`・`*.md`・`site/site.meta.yaml.example` など |
| フル Docs Build | サイトの JS / 設定変更（例: `site/app/**`、`site/server/**`、`nuxt.config.ts`、`package.json`、i18n など） |
| ジョブ | **`Docs Build`**: スキップしないときスコープ付き `npm ci`（site + library/data）+ `npm run build:site` |
| 対象外 | アプリの `npm test`、アプリ単体の検証、およびアプリ CI の成否 — **`doc-site` へのマージ判定では無視** |
| Deploy は続く | コンテンツのみでも `doc-site` へのマージ後は **Deploy Docs** が走り Pages を更新する |

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
| 公開 | GitHub Actions Pages（`upload-pages-artifact` → `deploy-pages`）。**`gh-pages` ブランチは使わない** |
| 独立 | アプリ CI、`data-v*` / `app-v*` の npm リリース、旧 `site-v*` タグ（廃止）とは無関係 |

**人手のリポジトリ設定:** GitHub Pages → Source = **GitHub Actions**。カスタムドメイン `jplocalgov.oss.b4m.jp` は `site/public/CNAME` で維持する。

## ソース Excel 監視（`.github/workflows/monitor-source-hash.yml`）

| 項目 | ルール |
|------|--------|
| トリガ | 週次 cron（月曜 01:30 UTC）+ `workflow_dispatch` |
| 内容 | 総務省 Excel を取得し `resources/000925835.xlsx` と SHA-256 比較 → `site/public/source-monitor.json` を更新コミット |
| Install | scripts ワークスペースのみ |
| 異常時 | `source-monitor` ラベルの Issue 起票／コメント、job failure |
| 詳細 | [test-spec-66-source-hash.md](./test-spec-66-source-hash.md) / Issue #66 |

## OpenSSF Scorecard（`.github/workflows/scorecard.yml`）

| 項目 | ルール |
|------|--------|
| トリガ | 週次 cron（月曜 01:30 UTC）、`branch_protection_rule`、`workflow_dispatch` |
| 発火しない | `main` への毎回 push（冗長実行削減のため削除） |

## CD — npm publish（`.github/workflows/publish.yml`）

| 項目 | ルール |
|------|--------|
| トリガ | `data-v*` / `app-v*` の GitHub Release **published**、またはタグ指定の `workflow_dispatch` |
| 祖先チェック | タグのコミットが `origin/release` の祖先であること |
| 検証スキップ | その SHA に CI success があれば **Test を省略**。**Build は常に実行**（`dist/` は gitignore） |
| 履歴なし | Test + Build のあと publish |
| dispatch | `force_test` で常に Test 可能 |
| Install | アプリ系ワークスペースのみ（site なし） |

`data-v*` / `app-v*` タグは **`release` ブランチから**打つ。`release-on-tag.yml` はこれらのタグのみ自動 Release 作成。

## v1.0.0 正式リリース（Issue #121）

Codecov の **project coverage ≥ 90%**（`codecov.yml` の `target: 90%`）を正式リリースのゲートとする。

1. `develop` 向け PR で Test が緑、かつ Codecov project status が ≥ 90% であること
2. `main` / `release` へ取り込み後、`main` push の coverage upload で default branch バッジが ≥ 90% になること
3. app / data の version を `1.0.0` に揃える（rc 外し）
4. `release` ブランチから `app-v1.0.0` / `data-v1.0.0` をタグ → Release → Publish
5. Issue #121 を Close

## v1.0.0 以降

以降の app タグ（`app-v1.1.0`、`app-v1.2.0` など）も同じ **`release` からタグ → Release → Publish** の流れ。API のみの変更では data を `data-v1.0.0` のままにする場合がある（app `1.2.0` など）。

## 流れ

```text
# アプリ / ライブラリ
ローカル変更 → npm run ci:local（必須）
            → develop / dev-* へ PR
            → CI Gate → "Test & Build"（単一ジョブ）
release への push → CI（publish スキップ用の履歴）
release 上のタグ → Release → Publish（Test 再利用 or 再検証、Build は常時）→ npm

# ドキュメントサイト
サイト JS/設定 → doc-site へ PR → Docs CI（"Docs Build"）
コンテンツのみ → doc-site へ PR → Docs CI Gate がビルドをスキップ
              → doc-site へマージ → Deploy Docs → GitHub Pages（Actions）
```

