# Cloudflare へのデプロイ

> **要点**
> - 認証して `npm run deploy:cloudflare` を実行するだけ。D1・R2 の作成も自動
> - 初回管理者のパスワードは `npx wrangler secret put OCTOPUS_BOOTSTRAP_ADMIN_PASSWORD`（再デプロイ不要）
> - セッション機能は Durable Object + WebSocket で、無料プランで数百人まで動く

## 手順

1. `wrangler login`、または環境変数 `CLOUDFLARE_API_TOKEN` / `CLOUDFLARE_ACCOUNT_ID` で認証する
2. `npm run deploy:cloudflare`
3. `npm run secret:bootstrap`（= `wrangler secret put OCTOPUS_BOOTSTRAP_ADMIN_PASSWORD`）で初回管理者のパスワードを登録する。入力は伏せ字で、履歴・ファイルに残らない（[詳細](authentication.md)）

### 初回だけ必要な手作業

- ダッシュボードで **R2 を有効化**する（カード登録が必要。従量課金は R2 のみで、自動停止の上限は無い）
- Billing の通知・使用量アラートを設定する
- 認証は `wrangler login`（OAuth）が簡単。API トークンを使う場合は環境変数で渡し、リポジトリに置かない

Wrangler は 4.36 以上が必要です（レート制限バインディングのため。`npm ci` で入ります）。

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

セッション機能に必要な設定を追記してください。`wrangler.example.toml` 末尾の `[[durable_objects.bindings]]`、`[[migrations]]`、`[[ratelimits]]` です。`[[ratelimits]]` が無いとレート制限は無効になります。無い場合は R2 版に自動でフォールバックしますが、大人数には向きません。

### 無差別アクセスへの備え（レート制限）

公開 URL は不特定多数から到達できるため、`/rpc` と `/ws` の入口で R2・D1・Durable Object に触る前にレート制限をかけます（`packages/infrastructures/src/cloudflare/rate-limit.ts`）。

| バインディング | 対象 | 既定の上限 |
| --- | --- | --- |
| `LOGIN_LIMITER` | `accounts_login`（総当たり対策） | 接続元 IP ごとに 10 回 / 60 秒 |
| `PUBLIC_LIMITER` | その他の `/rpc` と `/ws` | 接続元 IP ごとに 1200 回 / 60 秒（会場の共有 IP を考慮して緩め） |

- 上限は `wrangler.example.toml` の `[[ratelimits]]` で変更できます。超過は 429 を返します。
- カウンタは Cloudflare のロケーションごとの結果整合で、厳密な上限ではありません。アカウント内で `namespace_id` を重複させないでください。
- 独自ドメイン（ゾーン）が無いため、Cloudflare Access や WAF のレート制限ルールは使っていません。ドメインを用意すれば管理系を Access で隠せます。
- アカウント側のロック（同一 ID 5 回失敗で 15 分）と組み合わせて使います。

### 無料枠

セッション機能は **セッション 1 件につき Durable Object 1 つ**（SQLite バックエンド＝無料プラン可）で、更新は WebSocket で push します。ポーリングだと参加者 300 人で無料枠（Workers 10 万リクエスト/日）を約 17 分で使い切るためです。

想定最大（参加者 300 人・2 時間のイベントを 1 日 2 回）でも無料枠の 30% 以内に収まることを、`packages/session-hub` の予算テストで固定しています。試算と設計ルールは [session-hub.md](session-hub.md#cloudflare-無料枠の予算) を参照してください。

### ローカルでの動作確認

`npm run build && npm run e2e` で、ローカルの実 workerd（`wrangler dev --local`）に対して Durable Object / WebSocket を含む通しの動作を確認できます。ダミー ID のローカル設定を一時ディレクトリに作るだけで、リモートには触れません。
