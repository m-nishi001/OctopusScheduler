# 開発ガイド

> **要点**
> - Node.js 22 で `npm ci`。ビルドは Turborepo 経由（`npm run build`）
> - 変更したら `npm run lint:typecheck`・`npm test`・`npm run verify` が通ること。CI も同じ（CI はさらに `npm run test:coverage`）
> - 画面の通しは `npm run e2e`（実 workerd と Playwright）。**e2e は ビルド済みの `dist` を使う**ので、コードを直したら `npm run build` してから流す
> - **サーバー側コードを触った後は `npm run build:force`**（古いキャッシュで `verify` が誤って通ることがある）

## セットアップ

新しい PC やコンテナの作り直しは [開発環境を作る](dev-environment.md)(devcontainer で自動。足りないログインは `npm run doctor` で確認)。手元の環境では:

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
| `npm run test:coverage` | カバレッジの下限の確認（server / model / transport など。下限は各パッケージの `vitest.config.ts`） |
| `npm run verify` | GAS エンドポイント契約と `dist` の検証 |
| `npm run e2e` | 実 workerd のスモーク（29 項目）＋ Playwright の複数端末テスト |
| `npm run e2e:gas` | 同じ Playwright のテストを、GAS 実行環境シミュレーター（`scripts/gas-sim`）に対して流す |
| `npm run deploy:gas` / `npm run deploy:cloudflare` | デプロイ（[GAS](deploy-gas.md) / [Cloudflare](deploy-cloudflare.md)） |
| `npm run seed:local-admin` | ローカルに管理者とログイン済みセッションを投入（[詳細](authentication.md#ローカル開発で使う)） |
| `npm run dev:stack` | 架空データ入りの実 workerd を1コマンドで起動（[手順書](dev-verification.md)） |
| `npm run staging:up` / `staging:down` | Cloudflare 上の試験環境を作る／撤去する（[手順書](dev-verification.md#3-cloudflare-上の試験環境staging)） |

## テストの種類

| 種類 | 内容 | コマンド |
| --- | --- | --- |
| ユニット／コンポーネント | 各パッケージの vitest | `npm test` |
| 契約検証 | クライアントの呼び出し名とサーバーの公開関数の一致 | `npm run verify` |
| 実 workerd のスモーク | Durable Object / WebSocket / 回答ラウンド | `npm run build && npm run e2e -- worker-smoke` |
| 複数端末 E2E | ホスト・管理・参加者を別コンテキストで同時に動かす通し | `npm run build && npm run e2e -- ui`（初回は `npx playwright install chromium`） |

| GAS 向け E2E | `dist/gas/server.js` を GAS に近い条件で動かして、同じ画面の通しを流す | `npm run build && npm run e2e:gas`（`-- --shard=1/6` などで絞れる） |

### GAS 実行環境シミュレーター（`scripts/gas-sim`）

GAS 向けのバンドル（`dist/gas/server.js`）を、実機に近い条件で Node 上で動かすローカル専用のツールです（外部へのアクセスはありません）。`GET /` で `doGet` を通して `dist/gas/index.html` を返し、偽の `google.script.run` が `POST /rpc` でサーバー関数を呼びます（WebSocket は無いので、クライアントは自動でポーリングに切り替わります）。

- 実行ごとに状態がまっさらな vm コンテキスト（`worker_thread` のプール。既定 20、`GAS_SIM_CONCURRENCY`）。超えた呼び出しは `Service invoked too many times in a short time`
- 1 呼び出しに既定 200ms ±25% の遅延（`GAS_SIM_LATENCY_MS`）。Drive の操作にだけ足す遅延は `GAS_SIM_DRIVE_LATENCY_MS`
- Properties / Cache / Drive / Lock は共有し、`LockService.waitLock` は本物と同様にブロックする。ScriptProperties は 1 値 9KB・合計 500KB、Cache は 100KB、1 実行の上限は 6 分（`GAS_SIM_EXEC_LIMIT_MS`）
- `setTimeout` / `crypto` / `structuredClone` / `TextEncoder` / `URL` など、GAS に無いものは定義しない。`SpreadsheetApp` / `FormApp` は呼ぶと例外
- 呼び出しの記録は `GAS_SIM_TRACE=1`、`console` の出力は `GAS_SIM_VERBOSE=1`。統計は `GET /__sim/stats`
- Cloudflare 専用のテスト（WebSocket を遮断するもの、`worker-smoke`）は `test.skip(isGas, …)` で外す（`e2e/ui/fixtures.ts` の `isGas`）

実機の挙動と完全には一致しません（実際の同時実行の上限、Drive の遅延のばらつきなど）。実デプロイでの最終確認は別に必要です。

CI（`.github/workflows/ci.yml`）は lint → typecheck → test(＋カバレッジの下限) → build → verify → e2e を実行します。E2E が失敗したときは、スクリーンショットとトレースが成果物として残ります。

### カバレッジの下限

測る範囲は「ロジックがある所」(server・model・転送・制御)で、GAS / Cloudflare のアダプタや画面は含めません(実機・e2e で確かめる)。下限は**現在の実測を少し下回る値**で、後退を防ぐためのものです。上げる方向にだけ見直します。

| パッケージ | 範囲 | 下限(文 / 分岐 / 関数 / 行) |
| --- | --- | --- |
| session-hub | server・client/model・shared | 85 / 80 / 85 / 88 |
| accounts | server | 90 / 85 / 90 / 90 |
| infrastructures | compositions・interfaces | 80 / 70 / 90 / 80 |
| sync-engine | 全体 | 90 / 70 / 90 / 90(分岐は22個で、並列実行の負荷で揺らぐため低め) |
| game-jackpot | client/model・client/control | 68 / 62 / 65 / 68 |
| app-scheduler | client/model・client/control・server | 57 / 58 / 60 / 55 |

game-jackpot と app-scheduler は、目標の 85% にまだ届いていません(画面と密に結びついた制御が多い)。

### E2E の書き方

- **リトライは使いません**(`retries: 0`)。落ちたら、待ち方かアプリを直します。
- 固定の `waitForTimeout` は、「何も起きないことの確認(締切が Enter では動かない、など)」「描画が落ち着くまでの待ち(スクリーンショット)」「Enter を間隔を空けて押す進行」に限ります。何かが起きるのを待つときは `expect(...)` / `expect.poll(...)` で状態を待ちます。
- **同じ環境で繰り返し流すと、取り残しに当たることがあります**(例: `keyboard-shortcuts` が staging に作るショートカット。端末側の保存は同期で後から届くため、新しいブラウザは起動直後に前回の分を持っていない)。CI とローカルは毎回まっさらな環境なので起きません。staging では、実行ごとに別のキーを使い、後始末をしていますが、確実ではありません。おかしいときは、設定 > ショートカットの一覧から手で消してください。
- **名簿に前から居る人がいる環境**(staging のシード参加者 20 人など)では、`jackpot-scale` は名簿の人数を実測して抽選回数と終了の理由(景品が尽きたか、メンバーが尽きたか)を決めます。「景品 > メンバー」で終わる経路を通るのは、まっさらなローカル/CI だけです。
- 画面の挙動を `console.log` の文言で読むテストがあります(`jackpot-stop-patterns` が `[MemberDrawAnimation] stopAt: pattern` / `[RouletteAnimation] stop pattern` を読む)。そのログの文言は変えない・消さない。

## 知っておくと迷わないこと

- **古いキャッシュ**: 機能パッケージの `server/` を編集した後は、`npm run build:force` してから `npm run verify` を実行する。`infrastructures` が各機能パッケージのサーバーコードを取り込むが、Turborepo の依存グラフには載っていない（循環依存を避けるため）。
- **git worktree**: worktree には `node_modules` が無い。作ったら最初に `npm ci` を実行する。
- **ローカルで画面を確認**: Wrangler 4 を使う（`npx -y wrangler@4 dev --local`）。ポートは他のセッションと衝突しやすいので、空いているポートを指定する。
- **公開リポジトリ**: 実際の ID・トークン・パスワードをコミットしない。試行用の設定は一時ディレクトリに置く。
- **Turborepo**: バージョンによって設定やコマンドが異なる。設定を変えるときは、インストール済みの `turbo` に同梱されたドキュメント（`node_modules/turbo/docs`）を先に読む。

## 新しい機能を足すとき

- サーバー関数は、各機能パッケージの `src/server/*-api-contract.ts` に名前を足し、`endpoints.ts` で実装する。認可は `secure("admin" | "public", …)` で必ず指定し、本体は `respond(() => …)`（`@octopus/infrastructures/interfaces`）で包む。成功・失敗の JSON への変換と、業務エラー（`DomainError`）を再試行不要にする処理を1か所にまとめている。
- 公開（`export`）する関数・クラス・`export const f = () =>` には JSDoc を付ける。何をするものかが分かる1行でよい。付いていないと lint（`jsdoc/require-jsdoc`）で落ちる。テストと `testing/` は対象外。
- UI は `@octopus/ui-kit` の部品で組む。独自の overlay・色・フォントサイズ・絵文字アイコンは作らない（規約は `packages/ui-kit/README.md`）。
- 新しい画面は既定で管理者ログイン必須。ログイン済みの参加者向け画面は `/p` 配下に置く(`apps/app-scheduler/src/client/control/router/auth-guard.ts`)。ログイン不要にするのはログイン画面だけ。
- 構成のルールは [architecture.md](architecture.md) を参照。
