# Cloudflare へのデプロイ

> **要点**
> - 認証して `npm run deploy:cloudflare` を実行するだけ。D1・R2 の作成も自動
> - 初回管理者のパスワードは `npm run secret:bootstrap`（再デプロイ不要）
> - 作ったものは `npm run teardown:cloudflare` でまとめて削除できる
> - セッション機能は Durable Object + WebSocket で、無料プランで数百人まで動く

## まずこれだけ（早見表）

認証済み（`npx wrangler whoami` で自分のアカウントが出る）なら、毎回この順に実行するだけです。認証が切れていたら、先に[下の手順](#docker--コンテナ内で-wrangler-login-が完了しない)で `npx wrangler login --callback-host=0.0.0.0` を実行してください。

| やりたいこと | コマンド | 補足 |
| --- | --- | --- |
| 作る・更新する | `npm run deploy:cloudflare` | 何度実行してもよい。表示された URL が公開先（反映に数十秒） |
| 最初の管理者を作る | `npm run secret:bootstrap` | 新規に作ったときだけ。パスワードを入力し、ID `admin` でログイン |
| 全部消す | `npm run teardown:cloudflare -- --yes` | R2 が空でないと失敗する → 下の「削除」へ |
| 消すが管理者は残す | `npm run teardown:cloudflare -- --yes --keep-bucket` | 次の deploy で `secret:bootstrap` は不要 |

**全部消すときの流れ**: ① `npm run teardown:cloudflare -- --yes` → R2 で失敗したら ② ダッシュボードの R2 → `octopus-scheduler-assets` → Settings → **Empty Bucket** → ③ もう一度 ① を実行。

アカウントに初めてデプロイするときだけ、[R2 の有効化と課金通知](#初回だけ必要な手作業)が必要です。

## 手順

1. `npx wrangler login`、または環境変数 `CLOUDFLARE_API_TOKEN` / `CLOUDFLARE_ACCOUNT_ID` で認証する（`wrangler` はリポジトリ内の依存なので、単体で呼ぶときは `npx` が必要。`npm run` 経由なら不要）
2. `npm run deploy:cloudflare`（完了すると `https://octopus-scheduler.<アカウントのサブドメイン>.workers.dev` が表示される。反映に数十秒かかり、その間は 404 や error 1042 が出ることがある）
3. `npm run secret:bootstrap`（= `wrangler secret put OCTOPUS_BOOTSTRAP_ADMIN_PASSWORD`）で初回管理者のパスワードを登録する。入力は伏せ字で、履歴・ファイルに残らない（[詳細](authentication.md)）

### 初回だけ必要な手作業

- ダッシュボードで **R2 を有効化**する（カード登録が必要。従量課金は R2 のみで、自動停止の上限は無い）
- Billing の通知・使用量アラートを設定する
- 認証は `wrangler login`（OAuth）が簡単。API トークンを使う場合は環境変数で渡し、リポジトリに置かない

Wrangler は 4.36 以上が必要です（レート制限バインディングのため。`npm ci` で入ります）。

### Docker / コンテナ内で `wrangler login` が完了しない

ブラウザの認証後の戻り先（コンテナ内の `localhost:8976`）に、ホストのブラウザから届かないためです。コールバックの待ち受けを全インターフェースにして実行してください。

```
npx wrangler login --callback-host=0.0.0.0
```

これでも通らない場合は、API トークンを使います。`read -s` なら履歴に残りません。トークンはリポジトリやチャットに置かないでください。

```
read -rs CLOUDFLARE_API_TOKEN && export CLOUDFLARE_API_TOKEN
export CLOUDFLARE_ACCOUNT_ID=<アカウントID>
npx wrangler whoami
```

## `deploy:cloudflare` がやること（すべて冪等）

1. ビルド
2. `scripts/setup-cloudflare.js`: D1 データベースと R2 バケットが無ければ作成し、`wrangler.example.toml` から `wrangler.toml` を生成
3. `wrangler d1 migrations apply DB --remote`: `packages/infrastructures/migrations` を適用
4. `wrangler deploy`

## 削除（作り直したいとき・使わない間）

`npm run teardown:cloudflare` で、`deploy:cloudflare` が作ったものをまとめて削除します。次の `deploy:cloudflare` で、また一から作られます。

| 操作 | コマンド |
| --- | --- |
| 対象を表示するだけ（何も消さない） | `npm run teardown:cloudflare -- --dry-run` |
| 削除（Worker 名の入力で確認） | `npm run teardown:cloudflare` |
| 確認なしで削除 | `npm run teardown:cloudflare -- --yes` |
| R2 は残して削除（管理者アカウントを維持） | `npm run teardown:cloudflare -- --keep-bucket` |

- 削除するのは Worker（Durable Object と secret を含む）、D1、R2 バケット、ローカルの `wrangler.toml` です。
- 管理者アカウントとセッションは R2 にあるため、バケットを消すと失われます。次回の `deploy:cloudflare` 後に `npm run secret:bootstrap` でやり直してください。`--keep-bucket` なら引き継がれ、ブートストラップは不要です。
- **R2 バケットは空でないと削除できません。** wrangler にバケットを空にするコマンドが無いため、失敗したらダッシュボードの R2 → 対象バケット → Settings → Empty Bucket で空にし、同じコマンドをもう一度実行してください（削除済みのものはスキップされます）。
- 公開だけ止めたい場合は、ダッシュボードの Workers → Settings → Domains & Routes で `workers.dev` を無効にすれば足ります（データは残ります）。

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
