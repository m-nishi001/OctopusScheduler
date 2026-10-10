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
├─ game-jackpot/         ジャックポット抽選
├─ game-quiz/            クイズ
├─ infrastructures/      GAS／Cloudflare の実装を差し替える層
├─ sync-engine/          ファイル・JSON の差分同期
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

## 保存

アセットや JSON は、環境を問わず `<module>/<kind>/<name>` のルート相対パスで保存します（例: `octopus-scheduler/assets/1_a.png`、`quiz-game/json/quizzes.json`）。パスの組み立ては `packages/infrastructures/src/compositions/storage-paths.ts` に集約され、各環境のアダプタが実体に対応付けます。

| 環境 | 単純な値（名簿・設定など） | ファイル・JSON |
| --- | --- | --- |
| GAS | スクリプト プロパティ | Drive（ルートフォルダ配下） |
| Cloudflare | R2（専用の名前空間） | R2 |

## 関連

- セッション基盤の設計 → [session-hub.md](session-hub.md)
- 設計の経緯 → [design-decisions.md](design-decisions.md)
