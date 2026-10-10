# Cloudflare へのデプロイ

> **要点**
> - 認証して `npm run deploy:cloudflare` を実行するだけ。D1・R2 の作成も自動
> - 初回管理者のパスワードは `npx wrangler secret put OCTOPUS_BOOTSTRAP_ADMIN_PASSWORD`（再デプロイ不要）
> - セッション機能は Durable Object + WebSocket で、無料プランで数百人まで動く

## 手順

1. `wrangler login`、または環境変数 `CLOUDFLARE_API_TOKEN` / `CLOUDFLARE_ACCOUNT_ID` で認証する
2. `npm run deploy:cloudflare`
3. `npx wrangler secret put OCTOPUS_BOOTSTRAP_ADMIN_PASSWORD` で初回管理者のパスワードを登録する（[詳細](authentication.md)）

## `deploy:cloudflare` がやること（すべて冪等）

1. ビルド
2. `scripts/setup-cloudflare.js`: D1 データベースと R2 バケットが無ければ作成し、`wrangler.example.toml` から `wrangler.toml` を生成
3. `wrangler d1 migrations apply DB --remote`: `packages/infrastructures/migrations` を適用
4. `wrangler deploy`

## 設定

| 項目 | 既定値 | 変更方法 |
| --- | --- | --- |
| D1 データベース名 | `octopus-scheduler-db` | 環境変数 `CLOUDFLARE_D1_NAME` |
| R2 バケット名 | `octopus-scheduler-assets` | 環境変数 `CLOUDFLARE_R2_BUCKET` |

ルートフォルダの設定は不要です（R2 のキー接頭辞としてそのまま使われます）。

## 詳細

### 既存の `wrangler.toml` がある場合

セッション機能に必要な設定を追記してください。`wrangler.example.toml` 末尾の `[[durable_objects.bindings]]` と `[[migrations]]` です。無い場合は R2 版に自動でフォールバックしますが、大人数には向きません。

### 無料枠

セッション機能は **セッション 1 件につき Durable Object 1 つ**（SQLite バックエンド＝無料プラン可）で、更新は WebSocket で push します。ポーリングだと参加者 300 人で無料枠（Workers 10 万リクエスト/日）を約 17 分で使い切るためです。

想定最大（参加者 300 人・2 時間のイベントを 1 日 2 回）でも無料枠の 30% 以内に収まることを、`packages/session-hub` の予算テストで固定しています。試算と設計ルールは [session-hub.md](session-hub.md#cloudflare-無料枠の予算) を参照してください。

### ローカルでの動作確認

`npm run build && npm run e2e` で、ローカルの実 workerd（`wrangler dev --local`）に対して Durable Object / WebSocket を含む通しの動作を確認できます。ダミー ID のローカル設定を一時ディレクトリに作るだけで、リモートには触れません。
