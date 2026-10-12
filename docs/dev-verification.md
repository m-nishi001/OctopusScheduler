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

### 参加者ポータルを試す（10人規模）

1. 管理者で `/#/sessions` を開き、セッションを作る →「ポータルに公開」を押す
2. ホスト用ウィンドウで「ホストとして開く」。管理者の「操作する」でコンソールを開く
3. 起動時に表示された「受付QR相当」のURLを、別のシークレットウィンドウ（スマホ幅）で開く → `/#/p` に着き、「接続中」になる。参加者を増やすときは、起動時に書き出される `.wrangler/dev-stack/participants.json`（全員分の受付QR相当URL）から選ぶ
4. コンソールの「参加者ポータルのイベント」に名前を入れて「イベントを開始」→ 全員の画面の上に「イベント発生中!」が出る。「イベントを終了」で消える
5. エントリー: 「イベントを開始」のあと「エントリー受付を開始」→ 参加者の画面に大きな「エントリー」ボタンが出る。「エントリー受付(バブル)」を押すと、ホストのウィンドウにバブルのステージが出て、押した人がポンと現れる。「締め切る」「再開」も試す
6. ジャックポット: 受付を締め切ったあと「ジャックポット: 抽選」を押し、「次へ」で進める。**当選者はエントリーした人だけ**（コンソールの「ジャックポットの抽選の対象」で「全メンバー」に切り替えると、全員が対象に戻る）
7. 自動で再現したいときは E2E: `node scripts/e2e-local.js ui -- e2e/ui/participant-portal.spec`（10人が別々のブラウザコンテキストで同時にログインし、イベントの開始/終了・途中参加・ホストのリロードを通す）。エントリーは `e2e/ui/participant-entry.spec`（10人が同時にエントリー → 会場のバブル・運営の一覧 → 重複・途中参加・締切・再開）。抽選への反映は `e2e/ui/participant-jackpot.spec`（エントリー者を1人に絞ると当選者が決まるので、対象外の人が当選しないことを決定的に確認できる）。**絞り込みの文字列はファイルのパス全体への正規表現なので、worktree の名前に含まれない語を使う**

### 投入されるデータ

`dev:stack` と `staging:up` は、起動時に次の架空データを R2 に入れ、ポータル公開済みのセッションまで用意する(`scripts/seed-test-data.js` / `seed-content.js` / `seed-session.js`)。

| 種類 | 内容 |
| --- | --- |
| アカウント | 管理者 1 名 + 参加者 `test-user-01`〜(既定20名)と受付QR用のログインキー |
| クイズ | 5 問(豆知識・暦・果物・宇宙・富士山)。果物クイズは選択肢に画像、豆知識/果物は BGM と景品(名前・画像・BGM)つき |
| 景品 | 6 種(1等〜参加賞。ルーレット/スロット、確率の重みはばらつきあり)。画像 2 種・BGM 2 種つき |
| 画面設定 | オープニング・説明・抽選・デモ・結果・エンディング(文言・画像・BGM・SE) |
| 画像・音 | スクリプトが生成する小さな PNG / WAV(ネットワーク不要・著作権の問題なし。音は短い自作の旋律) |
| セッション | 「年末ジャックポット抽選会(試験環境)」を作成し、参加者ポータルに公開済み(寿命 12 時間。切れたら `npm run staging:seed`) |
| 結果(サンプル) | 参加者ポータルの「結果」タブが最初から埋まるよう、クイズ3ラウンドの順位と抽選5件の当選履歴を投入(`seed-demo-` で始まる ID。実際に出題した結果とは混ざらない)。`test-user-03` などでログインすると「あなたが当選!」の強調も見える |

- クイズ・景品・画面設定・画像/音は**ブラウザが管理画面を開いたときに R2 から取り込まれる**(同期)。新しいブラウザで、クイズ管理(`/#/quiz-admin`)とジャックポット管理(`/#/execute/jackpot-admin`)を一度開けば揃う。すでに自分のデータがあるブラウザは、同期でシードを上書きしてしまうことがあるので、シークレットウィンドウで試す。
- ジャックポットのメンバーの「ランク」は同期の対象外のためシードできない(既定値 5)。抽選結果・クイズの回答は操作して作る。
- 確認用の E2E: `E2E_SEEDED=1 BASE=<URL> E2E_ADMIN_TOKEN=<管理者トークン> npx playwright test -c e2e/playwright.config.ts seeded-content`(画面の見た目は `E2E_SHOTS=<出力先>` でスクリーンショットに保存)

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
