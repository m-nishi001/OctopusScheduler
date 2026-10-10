# ドキュメント目次

各ページの先頭に「要点」を置いています。**急ぐ人は要点だけ、詳しく知りたい人は本文**を読んでください。

## 役割別の入口

| あなたは | まず読む | 次に読む |
| --- | --- | --- |
| イベントで使う人 | [usage.md](usage.md) | [authentication.md](authentication.md) |
| デプロイする人 | [deploy-gas.md](deploy-gas.md) / [deploy-cloudflare.md](deploy-cloudflare.md) | [authentication.md](authentication.md) |
| 開発に参加する人 | [development.md](development.md) | [architecture.md](architecture.md) |
| セッション機能を触る人 | [session-hub.md](session-hub.md) | [architecture.md](architecture.md) |
| 設計の経緯を知りたい人 | [design-decisions.md](design-decisions.md) | |

## ページ一覧

| ページ | 内容 |
| --- | --- |
| [usage.md](usage.md) | 設定画面 → 実行画面の流れ、ショートカットの仕様 |
| [deploy-gas.md](deploy-gas.md) | GAS へのデプロイ、Drive フォルダ、公開設定 |
| [deploy-cloudflare.md](deploy-cloudflare.md) | Cloudflare へのデプロイ、作られるリソース、無料枠 |
| [authentication.md](authentication.md) | ログインの仕組み、初回管理者、総当たり対策、復旧 |
| [development.md](development.md) | セットアップ、コマンド、テスト、CI、ローカル確認 |
| [architecture.md](architecture.md) | パッケージ構成、依存ルール、保存パス |
| [session-hub.md](session-hub.md) | ホスト／管理／参加者を結ぶセッション基盤の設計と運用 |
| [design-decisions.md](design-decisions.md) | 主な意思決定と学び |

## 書き方のルール

- 1ページ1テーマ。先頭に「要点」を 3〜5 行で置く。
- 手順は番号付き、設定値は表にする。
- 同じ内容を複数のページに書かない（リンクで参照する）。
