# 開発中の通し動作確認

> **要点**
> - ローカルで通しを見るなら `npm run build && npm run dev:stack`(架空データ入りの実 workerd が立つ)
> - 本物の Cloudflare で見るなら `npm run staging:up`、終わったら必ず `npm run staging:down`
> - 自動テストは `npm run e2e`(ローカル)。staging に向けるときは `BASE` を指定する
> - 実 ID・パスワードは使わない(公開リポジトリ)。テストデータは全て架空

## 前提

- Node.js 22。worktree で作業するときは、最初にその worktree で `npm ci`(`node_modules` は worktree ごとに必要)
- `dist/cloudflare/worker.js` が必要なので `npm run build`。サーバー側コードを触った後は `npm run build:force`
- Wrangler は 4 系(`npx -y wrangler@4`。スクリプトが自動で使う)。同梱の 3 系は WSL2 で固まることがある

## 1. ローカルで通しを見る(`dev:stack`)

```bash
npm run build
npm run dev:stack -- --port 8841     # --port 省略時は空きポート。--count 参加者数(既定20)、--reset で作り直し
```

起動すると URL とログイン情報が表示される。

| 項目 | 内容 |
| --- | --- |
| 管理者 | ID `admin` / パスワード `local-dev-password` |
| 参加者 | `test-user-01` 〜 `test-user-20`(架空) / 共通パスワード `local-dev-password` |
| 状態の保存先 | `.wrangler/dev-stack/`(worktree ごと。gitignore 済み。`--reset` で消える) |

- Ctrl-C で停止。**他のセッションが使っているポートと衝突しやすい**ので、`--port` で自分用を決め、起動後にそのポートが自分の wrangler か確認する
- ブラウザを役割ごとに分ける(同じブラウザのタブだとログイン状態が共有される)
  - 管理者: 通常ウィンドウで `/#/login` から管理者でログイン
  - ホスト(会場スクリーン): 別プロファイル/シークレットウィンドウ。幅 1920×1080 目安
  - 参加者: 別のシークレットウィンドウ、または DevTools のデバイスモード(390×844)
- 管理者のログイン済み状態にしたいときは、表示された管理者トークンを `localStorage` の `octopus-session-token` に入れてリロード

### 今のところ投入されるデータ

管理者 1 名と参加者メンバー(名簿 + ログイン用の資格情報)。ポータル公開済みセッションやクイズ・景品のサンプルは、それぞれの機能が入る PR で `scripts/seed-test-data.js` に足す。

## 2. 自動テスト

| コマンド | 内容 |
| --- | --- |
| `npm test` | 単体テスト + `scripts/*.test.js` |
| `npm run build && npm run e2e` | ローカル workerd に対するスモーク + Playwright 複数端末 |
| `npm run build && npm run e2e -- ui` | 画面の通しだけ(初回は `npx playwright install chromium`) |

複数端末のテストは `e2e/ui/fixtures.ts` の `newDevice()` で端末(ブラウザコンテキスト)を増やして書く。待機は固定 sleep ではなく `expect(...).toBeVisible()` や `expect.poll` で状態を待つ。

無料枠の予算は `packages/session-hub` の `quota-budget.spec.ts` が強制する(想定最大でも無料枠の 30% 以内)。通信量を増やす変更は、ここが失敗しないことを確認する。

## 3. Cloudflare 上の試験環境(staging)

本物の Durable Object・WebSocket・レート制限の挙動を、会場を想定した複数端末で確認したいときに使う。本番とは Worker・D1・R2 をすべて分ける(`octopus-scheduler-staging*`)。

```bash
npm run build
npm run staging:up      # D1/R2 作成 → wrangler.staging.toml 生成 → migrate → deploy → 架空データ投入
# 表示された URL とログイン情報(パスワードは毎回ランダム)で確認する
npm run staging:down    # Worker / D1 / R2 を削除
```

- 認証: `wrangler login` するか、`CLOUDFLARE_API_TOKEN` / `CLOUDFLARE_ACCOUNT_ID` を設定しておく
- **本番と同じアカウントの無料枠を使う**。普段は撤去しておき、確認する時間だけ立てる。人数・時間を絞る
- `staging:up` は冪等(再実行しても既存リソースを使い、データを再投入する)
- Playwright を staging に向ける: `staging:up` の最後に表示される `BASE=… E2E_ADMIN_…=… npx playwright test -c e2e/playwright.config.ts` をそのまま実行する
- R2 バケットが空でないと `staging:down` は最後のバケット削除で止まる(wrangler に一覧・一括削除が無いため)。`staging:up` がバケットに「1日で自動削除」のルールを付けるので、**翌日以降にもう一度 `staging:down`** すれば消える。すぐ消したいときは、ダッシュボードの R2 → 該当バケット → Settings → Empty Bucket で空にしてから実行する。バケットだけが残っていても、Worker は削除済みなので外からは到達できない
- `wrangler.staging.toml`(リソース ID を含む)は gitignore 済み。コミットしない

## よくある失敗

| 症状 | 原因と対処 |
| --- | --- |
| `dist/cloudflare/worker.js がありません` | `npm run build` を先に実行 |
| ビルドが他パッケージの古い内容で通る/落ちる | worktree で `npm ci` していない、またはキャッシュ。`npm run build:force` |
| `wrangler dev` が起動しない/固まる | Wrangler 3 系を使っていないか。ポートが他セッションと衝突していないか(`--port` を変える) |
| 想定外のポートのアプリが開く | そのポートは別セッションの wrangler。cwd を確認して自分用ポートに変える |
| 参加者ログインが弾かれる | 同一 ID は 5 回失敗で 15 分ロック。`--reset` で作り直すか、時間を置く |
