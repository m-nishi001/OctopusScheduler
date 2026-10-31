# アーキテクチャ

> **要点**
> - monorepo。ホストの Web アプリは `apps/app-scheduler` の 1 つだけ。機能は `packages/*` に分ける
> - 各機能パッケージは `client/`（画面）と `server/`（エンドポイント）を持ち、公開 API 以外には依存しない
> - GAS と Cloudflare の差は `packages/infrastructures` のポート＆アダプターに閉じ込める
> - クライアントとサーバーの通信は「エンドポイント契約」で型付けし、`npm run verify` で突き合わせる

## 構成

```text
apps/
└─ app-scheduler/        ホスト Web アプリ（設定画面・実行画面・ログインなど）

packages/
├─ accounts/             メンバー名簿・ログイン・セッション・認可
├─ session-hub/          ホスト／管理／参加者を結ぶセッション基盤
├─ participant-portal/   ログイン済み参加者のスマホ向けポータル（画面のみ。通信は session-hub）
├─ game-jackpot/         ジャックポット抽選
├─ game-quiz/            クイズ
├─ infrastructures/      GAS／Cloudflare の実装を差し替える層
├─ sync-engine/          素材・一覧の同期(新しいほうが勝つ)
├─ client-common/        クライアント共通サービス
├─ composables/          共通 composable（useCachedResource など）
└─ ui-kit/               共通 UI 部品・デザイントークン
```

## 設計ルール

| ルール | 内容 |
| --- | --- |
| モジュール境界 | `package.json`（workspaces）が境界。`tsconfig.json` はコンパイラ設定に徹する |
| 公開 API | 各パッケージの `src/index.ts`（と `/server`）だけを公開し、他パッケージは内部パスに依存しない |
| 機能パッケージの形 | `src/client`（画面）と `src/server`（エンドポイントと契約）。ゲームは「単体アプリ」と「ホストに合成される機能」の二役を公開 API で分けている |
| 環境差 | `infrastructures` の `interfaces/`（契約）に対し、`gas/` と `cloudflare/` が実装を持つ。機能側は環境を知らない |
| UI | 設定画面は `ui-kit` の部品だけで組む |
| データ取得 | `useCachedResource` / `useCachedCollection` で「IndexedDB を即表示 → 背景で更新、書き込みは楽観的更新」。通信待ちを画面に出さない |

## サーバー側のつながり

1. 各機能パッケージが `src/server/*-api-contract.ts` にエンドポイント名を、`endpoints.ts` に実装を置く。
2. GAS では `infrastructures/src/gas/index.ts` が各機能の `/server` を取り込み、esbuild が公開関数を生成して 1 つのバンドルにする。Cloudflare では `infrastructures/src/cloudflare/index.ts` が同じハンドラを Worker から呼ぶ。
3. `npm run verify` が、クライアントの呼び出し名とサーバーの公開関数が契約と一致しているかを検証する。
4. すべてのエンドポイントは `secure("admin" | "public", handler)` で認可を宣言する（[authentication.md](authentication.md)）。

## 主な部品の置き場

| もの | 置き場 |
| --- | --- |
| 予定イベント（音楽・コンテンツ・スライドショー・画面遷移） | 保存形 `AppEventData`（`model/app-event/`）がそのまま実行時の型。種類ごとの違いは `control/app-event/app-event.ts` の表（実行 `RUNNERS`・新規の初期値 `EMPTY_FIELDS`）だけにある。編集は共通の `ScheduledEventDialog` と、種類ごとのフォーム `ui/pages/settings/app-events/events/*-form.vue`（ショートカットの編集と共通） |
| エンドポイントの成功・失敗の変換 | `respond()`（`infrastructures/interfaces`）。各 `endpoints.ts` はこれで本体を包む |
| 複数のパッケージで使う小さな部品 | `client-common`（`blobToDataUrl`・`{{asset:…}}` の解析 `assets/asset-placeholder.ts`・日時）、`ui-kit`（`lockScroll` など） |
| セッション基盤の中核 | `session-hub/src/server/engine/`（`engine-core` / `engine-join` / `engine-feed` / `engine-commands` / `engine-rounds`。外からは `session-engine.ts` 経由）と、`server/room/`（`room-core`・`room-repo`・`room-types`）。詳しくは [session-hub.md](session-hub.md) |

## 保存

アセットや JSON は、環境を問わず `<module>/<kind>/<name>` のルート相対パスで保存します（例: `octopus-scheduler/assets/1_a.png`、`quiz-game/json/quizzes.json`）。パスの組み立ては `packages/infrastructures/src/compositions/storage-paths.ts` に集約され、各環境のアダプタが実体に対応付けます。

| 環境 | 単純な値（名簿・設定など） | ファイル・JSON |
| --- | --- | --- |
| GAS | スクリプト プロパティ | Drive（ルートフォルダ配下） |
| Cloudflare | R2（専用の名前空間） | R2 |

## 同期（sync-engine）

端末（IndexedDB）とサーバー（Drive / R2）の間を、バックグラウンドで「新しいほうが勝つ」で揃えます。

- **一覧は、種類(kind)ごとに `{ data, updatedAt }` のレコードを1件**持ちます（画面設定・賞品・メンバー設定・クイズ一覧・ショートカット）。データと最終更新日時は一緒に1回で書き、更新日時は `max(いま, 前の更新日時 + 1)` です（端末の時計がずれても、自分の編集が負けない）。レコードが無いことと、空の一覧 `[]` は区別されるので、全件削除も同期されます。
- **サーバーにも同じ `{ updatedAt, data }` を、テキストのまま保存**します（`<module>/json/<名前>.json`）。サーバーは中身を見ず、サーバーの時刻も使いません。
- **push は保存して終わり**で、端末へ書き戻しません。送信の最中に編集しても、端末のほうが新しいままなので、次の同期で送られます。
- **pull は、判定のときからローカルの更新日時が変わっていなければ、サーバーのレコードをそのまま1回書く**だけです。書く直前にもう一度読み、変わっていたら書かずに戻ります（その編集は次の同期で送られます）。
- この動きは `blobRecordSyncTarget(kind, ローカル, サーバー)`（`sync-engine`）に1つにまとめ、各リポジトリはそれを呼ぶだけです。素材（画像・音声）は1件ごとの SyncTarget のままです。
- 結果は対象ごとの一覧 `SyncSummary.results`（`pushed` / `pulled` / `skipped` / `failed` と、失敗の理由）です。`useBackgroundSyncCore` は、失敗と「他の端末の変更を反映した」記録を、時刻付きで直近50件までメモリに持ち、ヘッダーの同期表示（`SyncStatusIndicator`）を押すと詳細として開けます。保存はしません。
- 他の端末の変更を取り込むと `syncPulled` が通知され、名簿・賞品・クイズ一覧・素材・画面設定の画面が読み直します。
- 制約: 一覧全体を1つの単位として同期するので、2台でほぼ同時に別の項目を編集すると、あとから保存したほうの一覧が残ります（先に保存した端末の詳細に「他の端末の変更を反映」と残ります）。

## 関連

- セッション基盤の設計 → [session-hub.md](session-hub.md)
- 設計の経緯 → [design-decisions.md](design-decisions.md)
