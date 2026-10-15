# specs

現行バージョンに存在する機能の仕様正本。ドメイン別に分割する（[tests](../tests/) と同じ切り方）。  
SemVer フォルダでは切らない。ルール正本: [charter/doc-rule.md](../charter/doc-rule.md)。

| ドメイン | パス | 内容 |
|----------|------|------|
| api | [api/](./api/) | API ロジック・エンティティ契約 |
| search | [search/](./search/) | ハイブリッド n-gram 検索 |
| data | [data/](./data/) | 配信データ形式・容量 |
| ops | [ops/](./ops/) | CI/CD・ソース監視 |
| messages | [messages/](./messages/) | エラー／警告メッセージカタログ |
| client | [client/](./client/) | クライアント初期バンドル |
| cache | [cache/](./cache/) | url 経路キャッシュと purge |

pillar: [../README.md](../README.md)　ロードマップ: [../roadmap.md](../roadmap.md)

----

以上
