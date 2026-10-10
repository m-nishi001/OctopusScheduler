# Octopus Scheduler

社内イベント（忘年会など）の現場で、モニターへの画面表示・BGM・ショートカット操作によるクイズや抽選を一元管理する進行演出ツールです。Google Apps Script（GAS）と Cloudflare のどちらでも動きます。

## 3ステップで動かす

前提: Node.js 22、`npm ci` 済み。

1. **デプロイする**: `npm run deploy:gas` または `npm run deploy:cloudflare`（事前準備は [GAS](docs/deploy-gas.md) / [Cloudflare](docs/deploy-cloudflare.md)）
2. **初回管理者のパスワードをシークレットに登録する**（再デプロイ不要）
3. **ログインする**: ログイン画面で ID `admin` とそのパスワードを入力 → [認証と初回管理者](docs/authentication.md)

## 知りたいことから探す

| 知りたいこと | 読むもの |
| --- | --- |
| 使い方（アセット・イベント・ショートカット） | [docs/usage.md](docs/usage.md) |
| デプロイ手順 | [GAS](docs/deploy-gas.md) / [Cloudflare](docs/deploy-cloudflare.md) |
| ログイン・初回管理者・復旧 | [docs/authentication.md](docs/authentication.md) |
| 開発の始め方・テスト・CI | [docs/development.md](docs/development.md) |
| 全体の構成・設計ルール | [docs/architecture.md](docs/architecture.md) |
| ホスト／管理／参加者のセッション基盤 | [docs/session-hub.md](docs/session-hub.md) |
| なぜこの設計にしたか | [docs/design-decisions.md](docs/design-decisions.md) |

全体の目次は [docs/README.md](docs/README.md) にあります。

## 技術スタック

TypeScript / Vue 3 / Vite / Vitest / Turborepo（monorepo）/ GAS + clasp / Cloudflare（Workers・D1・R2・Durable Objects）

---

実運用を目指しつつ、設計・実装・運用を通して学んだことを検証するポートフォリオでもあります。
