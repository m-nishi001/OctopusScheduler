# 開発ガイド

> **要点**
> - Node.js 22 で `npm ci`。ビルドは Turborepo 経由（`npm run build`）
> - 変更したら `npm run lint:typecheck`・`npm test`・`npm run verify` が通ること。CI も同じ
> - 画面の通しは `npm run e2e`（実 workerd と Playwright）
> - **サーバー側コードを触った後は `npm run build:force`**（古いキャッシュで `verify` が誤って通ることがある）

## セットアップ

```bash
npm ci
npm run build
```

## よく使うコマンド

| コマンド | 内容 |
| --- | --- |
| `npm run dev` | 開発サーバー（各パッケージ） |
| `npm run build` | ビルド（Turborepo）＋ `dist` へ成果物を集約 |
| `npm run build:force` | 生成物とキャッシュを消して作り直す |
| `npm run lint` / `npm run typecheck` | 静的チェック（`npm run lint:typecheck` で両方） |
| `npm test` | 全パッケージの単体テスト＋スクリプトのテスト |
| `npm run verify` | GAS エンドポイント契約と `dist` の検証 |
| `npm run e2e` | 実 workerd のスモーク（29 項目）＋ Playwright の複数端末テスト |
| `npm run deploy:gas` / `npm run deploy:cloudflare` | デプロイ（[GAS](deploy-gas.md) / [Cloudflare](deploy-cloudflare.md)） |
| `npm run seed:local-admin` | ローカルに管理者とログイン済みセッションを投入（[詳細](authentication.md#ローカル開発で使う)） |

## テストの種類

| 種類 | 内容 | コマンド |
| --- | --- | --- |
| ユニット／コンポーネント | 各パッケージの vitest | `npm test` |
| 契約検証 | クライアントの呼び出し名とサーバーの公開関数の一致 | `npm run verify` |
| 実 workerd のスモーク | Durable Object / WebSocket / 回答ラウンド | `npm run build && npm run e2e -- worker-smoke` |
| 複数端末 E2E | ホスト・管理・参加者を別コンテキストで同時に動かす通し | `npm run build && npm run e2e -- ui`（初回は `npx playwright install chromium`） |

CI（`.github/workflows/ci.yml`）は lint → typecheck → test → build → verify → e2e を順に実行します。E2E が失敗したときは、スクリーンショットとトレースが成果物として残ります。

## 知っておくと迷わないこと

- **古いキャッシュ**: 機能パッケージの `server/` を編集した後は、`npm run build:force` してから `npm run verify` を実行する。`infrastructures` が各機能パッケージのサーバーコードを取り込むが、Turborepo の依存グラフには載っていない（循環依存を避けるため）。
- **git worktree**: worktree には `node_modules` が無い。作ったら最初に `npm ci` を実行する。
- **ローカルで画面を確認**: Wrangler 4 を使う（`npx -y wrangler@4 dev --local`）。ポートは他のセッションと衝突しやすいので、空いているポートを指定する。
- **公開リポジトリ**: 実際の ID・トークン・パスワードをコミットしない。試行用の設定は一時ディレクトリに置く。
- **Turborepo**: バージョンによって設定やコマンドが異なる。設定を変えるときは、インストール済みの `turbo` に同梱されたドキュメント（`node_modules/turbo/docs`）を先に読む。

## 新しい機能を足すとき

- サーバー関数は、各機能パッケージの `src/server/*-api-contract.ts` に名前を足し、`endpoints.ts` で実装する。認可は `secure("admin" | "public", …)` で必ず指定する。
- UI は `@octopus/ui-kit` の部品で組む。独自の overlay・色・フォントサイズ・絵文字アイコンは作らない（規約は `packages/ui-kit/README.md`）。
- 新しい画面は既定でログイン必須。参加者に公開したい場合だけ、`apps/app-scheduler/src/client/control/router/admin-guard.ts` の許可リストに足す。
- 構成のルールは [architecture.md](architecture.md) を参照。
