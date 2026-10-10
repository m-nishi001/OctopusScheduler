# Octopus Scheduler

Octopus Scheduler は、社内イベント（忘年会等）の現場で、モニターへのリアルタイム画面表示やBGM再生、ショートカットキー操作によるクイズ・抽選機能の実行、Google Form連携による集計などを一元管理する進行演出ツールです。
社内の年末イベント運用で実際に使えることを目指しつつ、設計・実装・運用までを通して学習成果を検証するポートフォリオとして継続的に改善してきました。

## Project Purpose

- 現場価値: 社内イベントの進行を安定させるための、実用的な運営支援ツールを構築する
- 学習価値: 限られた期間の中で、アーキテクチャ設計・品質担保・性能改善を実践し、意思決定の妥当性を検証する

## Tech Stack

- TypeScript
- Vue 3
- Vite
- Node.js
- Vitest
- ESLint
- Turbo (monorepo task orchestration)
- Google Apps Script (GAS)
- clasp

## Architecture Highlights

- Monorepo でクライアント、共有パッケージ、API を分離
- **フォルダ構成がそのままモジュール構成**（`src/<layer>/<package>`）
- `@octopus/core` にクライアント/サーバ共通の契約（型）を集約
- レイヤード構成（core / model / ui）で責務を明確化
- 各パッケージは `src/index.ts` を公開 API とし、他パッケージは内部パスに依存しない
- 複数ゲーム系フロントエンドとスケジューラ機能を統合
- GAS 連携を前提にした運用設計とデータ同期戦略を実装

## Module Structure

```text
apps/
└─ app-scheduler/            @octopus/app-scheduler（唯一のホスト Web アプリ）

packages/
├─ core/                     @octopus/core（依存ゼロの共有契約）
├─ client-common/            @octopus/client-common
├─ composables/              @octopus/composables（useCachedResource など共通 composable）
├─ ui-kit/                   @octopus/ui-kit（設定画面の共通UI部品・デザイントークン）
├─ game-jackpot/             @octopus/game-jackpot
├─ game-quiz/                @octopus/game-quiz
├─ game-card/                @octopus/game-card
└─ server/                   @octopus/server（単一 GAS バンドル）
```

- モジュール境界は `package.json`（workspaces）であり、`tsconfig.json` はコンパイラ設定に徹する
- 依存方向は `core ← client / server` の一方向
- 設定画面は `@octopus/ui-kit` の部品(PageShell / DataTable / UiDialog / UiButton / UiIcon / FormGrid など)だけで組む。独自の overlay・色・フォントサイズ・絵文字アイコンは作らない(規約は `packages/ui-kit/README.md`)
- データ取得は `useCachedResource` / `useCachedCollection` で「IndexedDB 即表示 → 背景更新、書き込みは楽観的更新」とし、通信待ちを画面に出さない
- ゲーム系パッケージは「単体 Vite アプリ」と「ホストに合成される機能モジュール」の二役を公開 API で分離

## 使い方(設定画面 → 実行画面)

1. 設定画面で **アセット** を登録し、**イベント**(何を流すか)を作り、**ショートカット** でキーに割り当てる
2. ホームの「実行画面へ」または設定画面ヘッダーの「実行画面を開く」で、投影用の `/execute` を別タブ/別ウィンドウで開いておく(キー操作は BroadcastChannel で実行画面へ送られるため、開いていないと何も表示されない)
3. 設定画面やクイズ画面でキーを押すと実行画面に反映される

ショートカットの仕様: 最大3キー(押した順を区別)/ 1.5秒入力が途絶えるとリセット / 長いショートカットと前方一致する場合は0.4秒待って確定 / `Esc` は予約で全音声停止 / 文字入力欄にフォーカス中は無効。クイズ進行は各画面で `Enter` が次画面へ。画面ごとの案内は設定画面右上の「ヘルプ」(`settings/help/help-content.ts`)。

## Setup and Deployment

アセットや JSON は、環境を問わず `<module>/<kind>/<name>`（例: `octopus-scheduler/assets/1_a.png`, `quiz-game/json/quizzes.json`）というルート相対パスで保存されます。パスの組み立ては `packages/infrastructures/src/compositions/storage-paths.ts` に集約されており、各環境のアダプタが実体に対応付けます。

### Google Apps Script

1. Google Drive に保存先用のフォルダを1つ作成し、そのフォルダ ID（URL の `folders/` 以降）を控える
2. `.clasp.example.json` を `.clasp.json` にコピーし、`scriptId` を設定する
3. Apps Script の「プロジェクトの設定 → スクリプト プロパティ」に次を登録する

   | キー | 値 |
   | --- | --- |
   | `OCTOPUS_ROOT_FOLDER_ID` | 手順1のフォルダ ID |

4. `npm run deploy:gas`

- `OCTOPUS_ROOT_FOLDER_ID` が未設定、またはアクセスできないフォルダの場合は `StorageNotConfiguredError` で通知されます。
- 各モジュールのサブフォルダ（`octopus-scheduler/assets` など）は初回書き込み時に自動作成されます。作成時はスクリプトロックで直列化し、同名フォルダの重複生成を防ぎます。
- 過去の競合などで同名フォルダが既に複数ある場合は、作成日時が最古のフォルダを使用します。他のフォルダに入っているファイルは、Drive 上で最古のフォルダへ手動で移動し、空になった重複フォルダを削除してください。
- スライドショーイベントの「フォルダ名」は `octopus-scheduler/assets/<フォルダ名>` を指します。画像はそのフォルダに配置してください。

### Cloudflare

1. `wrangler login`、または環境変数 `CLOUDFLARE_API_TOKEN` / `CLOUDFLARE_ACCOUNT_ID` で認証する
2. `npm run deploy:cloudflare`

このコマンドは次を順に実行します（すべて冪等）。

1. ビルド
2. `scripts/setup-cloudflare.js`: D1 データベースと R2 バケットが無ければ作成し、`wrangler.example.toml` から `wrangler.toml` を生成
3. `wrangler d1 migrations apply DB --remote`: `packages/infrastructures/migrations` を適用
4. `wrangler deploy`

リソース名は既定で `octopus-scheduler-db` / `octopus-scheduler-assets` です。変更する場合は `CLOUDFLARE_D1_NAME` / `CLOUDFLARE_R2_BUCKET` を設定してください。Cloudflare ではルートフォルダの設定は不要です（R2 のキー接頭辞としてそのまま使われます）。

### 認証モード(app-mode.config.json)とローカル開発

`app-mode.config.json` の `mode` はビルド時に埋め込まれます。既定は `production` で、管理画面・管理系エンドポイントは管理者ログインが必須です。

- **最初の管理者の登録**: `development` に変更して再ビルドすると、ログインなしで設定画面のアカウント画面から管理者(パスワード必須)を登録できます。登録後は `production` に戻して再ビルド・デプロイしてください。
- **ローカル開発(wrangler dev --local)**: worktree ごとにローカルの D1/R2 が別になるため、`npm run seed:local-admin -- --config <wrangler.toml> [--persist-to <dir>]` で管理者とログイン済みセッションを投入できます(`SEED_ADMIN_ID` / `SEED_ADMIN_PASSWORD` / `SEED_SESSION_TOKEN` で指定可)。出力された `sessionToken` をブラウザの localStorage `octopus-session-token` に設定すると、ログイン済みで開けます。`--local` 専用で、リモートには書き込みません。

## Key Decisions and Rationale

### 1. Why GAS First

GAS を最初に選んだ理由は、運用コストを抑えられること、Google アカウント基盤によるセキュリティを活用できること、そして JavaScript ベースであるため Web エンジニアが比較的キャッチアップしやすいことです。  
また、万一本番中に不具合が発生しても、開発 PC がなくても現場で修正しやすい点を重視しました。

### 2. Why TypeScript + Vue + clasp Later

機能拡大に伴い、型のない実装では保守効率が急速に低下したため、途中から TypeScript / Vue / clasp を導入しました。  
結果として開発環境の準備コストは増えましたが、複雑性の増したプロダクトに対して品質と開発速度を維持するうえで妥当な判断だったと考えています。  
特にテスト観点では、GAS 単体では難しい検証を補えるようになり、実装の安全性を高められました。

### 3. Structure for Speed, and Its Trade-offs

短期間・単独開発で認知負荷を下げるため、型と構造のルールを強めに設計しました。  
これは変更影響の局所化と Open/Closed Principle の実践に寄与し、開発初期の速度向上に効果がありました。  
一方で、終盤には制約の強さが自由度を下げ、保守コスト増につながる局面もありました。  
「初期段階での過度な一般化は避ける」「YAGNI とのバランスを常に見直す」という学びを得ています。

### 4. Performance Tuning Under GAS Constraints

GAS 連携は時間帯によって関数呼び出し失敗が起きやすいため、リトライ機構、並列ダウンロード、ブラウザストレージ活用を組み合わせて体感性能を改善しました。  
本番運用では、GAS 基盤としては大きな遅延を抑えた状態で運用でき、対策の有効性を確認できました。

## Reflection

このプロジェクトを通じて、単に機能を作るだけでなく、制約下での技術選定、品質と速度の両立、そして将来の保守性を見据えたトレードオフ判断の重要性を実践的に学びました。

## Notes for Public Repository

- 機密情報や個人情報は公開対象から除外しています
- 設計意図と意思決定の記録を重視し、ポートフォリオとして読み取れる形に整理しています
