# テスト仕様書: ハイブリッド n-gram 検索インデックス（#63）

対象マイルストーン: `data-v1.0.0-rc.10` / `app-v1.0.0-rc.10`  
関連: [main.md](./main.md) / [logics.md](./logics.md) / [test-spec-73-csv-binary.md](./test-spec-73-csv-binary.md) / Issue #63 / #74  
作業ベース: `dev-app-v1.0.0-rc.10`  
想定実装ブランチ: `cursor/issue-63-jlix-generate-4c4d`

## 1. 目的

全国文字列検索向け索引を次の契約で固定する。

- **ホット団体** → **2-gram** 逆引き（地域ファイルに分割）
- **コールド団体** → **3-gram** 逆引き（**3** シャード、`FNV-1a(gram) % 3`）
- エンティティは **2-gram / 3-gram のどちらか一方のみ**（二重掲載しない）
- 都道府県は索引に載せない（初期化済み一覧の線形検索）
- 配信は **Brotli（`.bin.br`）**。中間 CSV / 非圧縮 `.bin` はリポジトリレビュー用（npm 非同梱）
- バイナリ中身は現行 **JLIX**（magic `JLIX`、13 bytes/posting）のまま。分割と gram 長だけが変わる

クライアント:

- 正規化後長に応じた索引選択
- 索引ファイルの **concurrency=3・開始 100ms ずらし** 並行ロード（メモリのみ）
- ≥3 文字では **2-gram ヒット有無に関わらず 3-gram も必ず**ロード・検索し結果をマージ

## 2. 用語

| 用語 | 意味 |
|------|------|
| JLIX | n-gram 検索インデックスバイナリ（magic `JLIX` = `0x4A 0x4C 0x49 0x58`） |
| posting | CSV/bin の 1 行（1 レコード）。`(gram, gramType, muniCode)` で一意 |
| 2-gram / 3-gram | 正規化済み文字列をコードポイント単位で切った隣接 n 文字 |
| ホット | 2-gram 索引に載せる市区町村（下記 §3） |
| コールド | 3-gram 索引に載せる市区町村（ホット以外） |
| region | 2-gram 成果物の地域 ID（例: `tokyo`, `chukyo`） |
| 3-gram shard | `0`..`2`（または `00`..`02`）。`FNV-1a(UTF-8(gram)) % 3` |
| 生 JLIX | decode 前の `ArrayBuffer` / `Uint8Array` |

代表サンプル:

| 対象 | 索引 | prefCode | muniCode | 備考 |
|------|------|----------|----------|------|
| 千代田区 | 2-gram（tokyo） | `13` | `131016` | 東京全域 |
| 名古屋市 | 2-gram（chukyo / designated） | `23` | `231002` | 政令市 |
| 那覇市 | 3-gram | `47` | `472018` | コールド例 |
| 大阪府 | （索引なし） | `27` | — | 線形検索のみ |

## 3. ホット集合（生成契約）

### 3.1 ルール（優先度は実装で決定的に）

1. **全都道府県内の全市区町村**: 東京（`13`）・神奈川（`14`）・埼玉（`11`）・大阪（`27`）
2. **当該県の全市**（名称が `市` で終わる団体。町村は含めない）: 愛知（`23`）・三重（`24`）・兵庫（`28`）・福岡（`40`）・岐阜（`21`）
3. **京都（`26`）**: 京都市（政令市ルール）＋南部市  
   `宇治市` / `城陽市` / `向日市` / `長岡京市` / `八幡市` / `京田辺市` / `木津川市` / `亀岡市`
4. **千葉（`12`）**: 千葉市（政令市ルール）＋西寄り市  
   `市川市` / `船橋市` / `松戸市` / `野田市` / `習志野市` / `柏市` / `流山市` / `八千代市` / `我孫子市` / `鎌ケ谷市` / `浦安市` / `四街道市` / `印西市` / `白井市`
5. **全国の政令指定都市本体・その行政区・東京特別区**は常にホット（上記と重複可）

### 3.2 2-gram region 分割（成果物）

| region ID | 内容 |
|-----------|------|
| `tokyo` | 東京都 |
| `kanagawa` | 神奈川県 |
| `saitama` | 埼玉県 |
| `chiba` | 千葉ホット分 |
| `osaka` | 大阪府 |
| `chukyo` | 愛知・三重・岐阜のホット分 |
| `hyogo` | 兵庫ホット分 |
| `kyoto` | 京都ホット分 |
| `fukuoka` | 福岡ホット分 |
| `designated-other` | 上記 region に属さない政令市・区 |

同一団体が複数 region に出てはならない（政令市は所属県 region 側に寄せ、`designated-other` は残りのみ）。

### 3.3 コールド

- ホットに含まれない全市区町村 → 3-gram のみ
- 都道府県行は **どちらの索引にも出さない**

## 4. 成果物・index 契約

### パス（npm 配信は `.bin.br`）

- `search-ngrams/2gram/{region}.bin.br`（およびレビュー用 `.bin` / 集約または分割 CSV）
- `search-ngrams/3gram/{shard}.bin.br`（`shardCount === 3`）
- 旧単一 `search-ngrams.bin(.br)` は **廃止**

### `index.json` の `paths.searchNgrams`（必須・オブジェクト）

```json
{
  "twoGram": {
    "regions": ["tokyo", "kanagawa", "saitama", "chiba", "osaka", "chukyo", "hyogo", "kyoto", "fukuoka", "designated-other"],
    "pattern": "search-ngrams/2gram/{region}.bin.br"
  },
  "threeGram": {
    "shardCount": 3,
    "pattern": "search-ngrams/3gram/{shard}.bin.br"
  }
}
```

- `{region}` / `{shard}` プレースホルダ必須
- `schemaVersion` は `1` 据え置き
- 既存 `paths.prefectures` / `paths.municipalitiesByPrefecture` は `.bin.br` 契約を維持（#74）

### dataset（`{ data }`）

- `searchNgramShards`（または同等）: region / shard キー → 生 JLIX `Uint8Array`
- 旧単一 `searchNgrams: Uint8Array` は廃止

## 5. gram ヘルパケース（TC-N）

実装先の目安: `packages/jp-local-gov-id/src/searchNgrams*.test.ts`

### TC-N01: コードポイント単位（2-gram / 3-gram）

- **操作**: 正規化済み文字列から `codePointBigrams` / `codePointTrigrams`
- **期待**: `[...str]` / `Array.from` 相当（UTF-16 コードユニットではない）
- **期待**: 半角濁点を含むかなでも境界を壊さない

### TC-N02: 長さ未満は空

- **操作**: 2-gram に対し正規化後長 `0`/`1`、3-gram に対し `0`/`1`/`2`
- **期待**: 空配列（短い gram を出さない）

### TC-N03: 連続 n-gram

- **操作**: 例 `中央区`（3 コードポイント）
- **期待**: 2-gram → `中央`,`央区` / 3-gram → `中央区`

### TC-N04: 正規化との接続

- **操作**: 生文字列に `normalizeSearchText` してから n-gram 化
- **期待**: 現行検索と同じ正規化結果に対する gram

### TC-N05: 3-gram shard 鍵

- **操作**: 既知 gram に対し `FNV-1a(UTF-8) % 3`
- **期待**: 実装と generate が同一関数・同一結果（クロスランタイムで安定）

## 6. バイナリ形式ケース（TC-B）

実装先: `packages/jp-local-gov-id/src/binary/*.test.ts`  
レイアウトは JLPR/JLDT と同型（little-endian）。レコード **13 bytes**。Kaitai `ngram_posting_record` と一致。

### TC-B01〜TC-B12

現行どおり（ラウンドトリップ、サイズ、string table 共有、決定的ソート `gram → gramType → muniCode`、u2 上限、不正 magic/version/truncation/offset/余剰バイト、endian）。

### TC-B13: kind

- **期待**: 生成索引の posting は **`kind=muni` のみ**（`pref` 行を出さない）
- **期待**: バイナリ enum に `pref=0` が残っていても、生成データでは未使用でよい

## 7. 生成・パッケージケース（TC-G）

### TC-G01: 成果物パス

- **期待**: 各 2-gram region と 3-gram shard（0..2）の `.bin` / `.bin.br` が存在
- **期待**: レビュー用 CSV が存在（単一集約または種別分割。npm 非同梱）
- **期待**: 旧 `search-ngrams.bin(.br)` が **残っていない**（generate 掃除）

### TC-G02: `index.json` paths

- **期待**: §4 のオブジェクト形。`twoGram.regions` が §3.2 と一致、`threeGram.shardCount === 3`
- **期待**: 欠落・文字列だけの旧形・`{shard}`/`{region}` 欠落は `validateIndexFile` で `LocalGovSchemaError`

### TC-G03: CSV 列

- **ヘッダ（集約の場合の例）**: `gram,gramType,kind,muniCode,prefCode,hasWard,isWard,indexKind,partition`  
  （`indexKind` = `2gram`|`3gram`、`partition` = region または shard id）
- **期待**: `(indexKind, partition, gram, gramType, muniCode)` で一意
- **期待**: `gramType` は `name`/`kana`、`kind` は `muni` のみ
- **期待**: 決定的ソート

### TC-G04: ホット / コールド分割

- **期待**: §3 のホット団体の posting は **2-gram 側のみ**
- **期待**: それ以外の市区町村は **3-gram 側のみ**
- **期待**: 同一 `muniCode` が 2-gram と 3-gram の両方に現れない
- **期待**: 都道府県 `kind=pref` がどちらにも現れない

### TC-G05: サンプル所属

| 団体 | 期待 |
|------|------|
| 千代田区 | 2-gram `tokyo` |
| 横浜市 / 区 | 2-gram `kanagawa` |
| 那覇市 | 3-gram（いずれかの shard） |
| 京都市 | 2-gram `kyoto`（または designated 寄せ規則どおり一意） |
| 舞鶴市 | 3-gram（京都ホット外の市） |
| 高山市 | 岐阜は全市ホットのため **2-gram `chukyo`** |
| 白川村 | 3-gram（町村） |

### TC-G06: 3-gram shard 配置

- **期待**: 各 3-gram posting の `gram` について `FNV-1a % 3` がファイル shard と一致
- **期待**: 3 ファイルの `record_count` 合計 === コールド posting 総数

### TC-G07: 2-gram region 配置

- **期待**: 各ホット posting が §3.2 のちょうど 1 region に属す
- **期待**: region ファイル群の `record_count` 合計 === ホット posting 総数

### TC-G08: 生成規則

- **期待**: 各フィールドは `normalizeSearchText` 後に n-gram 化
- **期待**: ホットは 2-gram（長 `< 2` のフィールドはスキップ）、コールドは 3-gram（長 `< 3` はスキップ）
- **期待**: `hasWard` / `isWard` は県別 CSV と同じ規則

### TC-G09: asOf

- **期待**: 全 JLIX ファイルの `asOf` が `prefectures.bin` と同じ生成世代

### TC-G10: npm 同梱

- **期待**: `files` / `exports` に `search-ngrams/2gram/*.bin.br` と `search-ngrams/3gram/*.bin.br`
- **期待**: CSV / 非圧縮 `.bin` は npm に含めない

### TC-G11: dataset

- **期待**: 全 region / shard の生 JLIX を供給でき、それぞれ `decodeSearchNgrams` 可能

### TC-G12: 掃除

- **操作**: generate 再実行
- **期待**: 旧単一ファイルと新ツリーが掃除されたうえで再生成

## 8. スキーマ・型ケース（TC-S）

### TC-S01: index paths 必須・形

- **操作**: `paths.searchNgrams` 欠落、文字列、`twoGram`/`threeGram` 不完全
- **期待**: `LocalGovSchemaError`

### TC-S02: LocalGovDataset

- **期待**: シャード辞書形。旧単一 `searchNgrams` バイトは型・正規化から除去
- **期待**: 全国検索に使う `{ data }` はシャード必須。不足時は検索時または作成時にスキーマエラー

### TC-S03: fixture

- **期待**: テスト用最小 index は新 `paths.searchNgrams` オブジェクトを持つ

## 9. クライアント検索ケース（TC-Q）

実装先: `api.test.ts` 等（`{ data }` で可）

### TC-Q01: 長 `< 2` → 空

- **操作**: `searchByText` / `getLocalGovCodeByName` に正規化後 1 コードポイント以下
- **期待**: `[]` / `null`。索引ファイルを fetch しない（url モードで観測可能な場合）

### TC-Q02: 長 `== 2` → 2-gram のみ

- **操作**: ホットに存在する 2 文字クエリ（例: 区名の一部で東京にヒットしうるもの）
- **期待**: 2-gram region のみロード対象。3-gram はロードしない
- **期待**: コールド団体だけにしか無い 2 文字はヒットしない（空またはホットのみ）

### TC-Q03: 長 `≥ 3` → 両方必須

- **操作**: ホットとコールドの両方に部分一致しうるクエリ（またはそれぞれ別クエリで合算契約を確認）
- **期待**: 2-gram 全 region と 3-gram 全 shard（3 本）をロード対象に含める
- **期待**: **2-gram でヒットしても 3-gram を省略しない**
- **期待**: 結果は両索引ヒットの **union**（その後エンティティ上で includes/equals 再確認は現行どおり）

### TC-Q04: コールド 3 文字

- **操作**: 例 `那覇市` 相当（正規化後 ≥3）
- **期待**: 2-gram ミス（または無関係ヒットのみ）でも 3-gram 経由で当該団体に到達

### TC-Q05: 都道府県

- **操作**: `target: "prefectures"` または都道府県名の全国検索
- **期待**: 索引を使わず線形。索引ロード義務なし

### TC-Q06: `options.prefecture` 指定

- **期待**: 当該県 `.bin.br` の線形検索。全国 n-gram 索引は使わない

### TC-Q07: 欠落 gram

- **期待**: ある gram の posting が無い → その索引面では空。フォールバック全件スキャンはしない

### TC-Q08: `matchField: "both"`

- **期待**: name/kana posting を混ぜてから積集合（Issue #63 既存決定）

### TC-Q09: asOf 不一致

- **期待**: JLIX と prefectures の `asOf` 不一致は `console.warn`。throw しない

### TC-Q10: 候補県ロード

- **期待**: 索引ヒット後、候補 `prefCode` の県 `.bin.br` のみ取得。concurrency 6。当該ロードは localStorage しない

## 10. ロードプールケース（TC-L）

### TC-L01: concurrency=3

- **操作**: 同時に 4 本以上の索引 fetch が必要な状況（モック）
- **期待**: 同時 in-flight は最大 3

### TC-L02: 100ms ずらし

- **操作**: フェイクタイマー
- **期待**: キュー上の次タスク開始が、先行開始から 100ms 間隔（concurrency 枠が空いていても schedule ずらす）

### TC-L03: メモリキャッシュ

- **期待**: 一度ロードした region/shard は同一クライアントで再 fetch しない
- **期待**: localStorage に JLIX を書かない

### TC-L04: url / data

- **期待**: `url` は必要ファイルを sibling URL 解決して取得（Brotli 展開 → decode）
- **期待**: `data` は供給済み生バイトを decode（Node は初回にまとめて可）

## 11. Kaitai ケース（TC-K）

### TC-K01 / TC-K02

- **期待**: `JLIX` → `ngram_posting_record`、enum・13 bytes は現行維持（ファイル分割は ksy 範囲外）

## 12. 非対象

| ID | 内容 |
|----|------|
| OUT-01 | 検索結果のストリーミング / 途中 partial return API |
| OUT-02 | 人気団体の先読み専用 API |
| OUT-03 | JLIX レコード幅の再圧縮（prefCode/flags 削除など） |
| OUT-04 | JLIX の localStorage キャッシュ |
| OUT-05 | ホット集合の人口統計連動の自動更新 |

## 13. 合格基準

- TC-N / TC-B / TC-G / TC-S / TC-Q / TC-L / TC-K が自動化または generate 後契約で確認できる
- `npm run generate` 後、§4 の全 `.bin.br` が存在し decode 可能。旧単一 JLIX が残っていない
- ホット/コールドの所属・非重複が契約テストで固定
- 長 2 は 2-gram のみ、長 ≥3 は両索引マージがテストで固定
- ロード concurrency=3・100ms ずらしがテストで固定
- `@b4moss/jp-local-gov-id` の公開 API テストがグリーン
- npm `files` に CSV / 非圧縮 `.bin` が混入していない
