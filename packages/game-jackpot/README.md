# game-jackpot(ジャックポット)

会場の抽選演出。抽選ロジックと演出はブラウザ側(ホスト端末)で動き、サーバは画像・BGM などのアセットと JSON の保管だけを担う。

## 抽選 API(`DrawApplicationService`)

- `executeDraw({ memberRequestCount, prizeRequestCount })`
  - 1 回分の本抽選(メンバー → 確変判定 → 景品)を計算し、**結果を保存してから**返す。
  - 戻り値は `{ result, prizeRes, memberRes }`。`prizeRes` はアニメーション用の素材(`winnerPrizeId` / `dummyPrizeIds` / `isKakuhen` / `dummyWinnerPrizeId`)。
  - 当選済みのメンバー・景品は二度当たらない。メンバーか景品が尽きている場合は例外にする。
- `previewDraw(...)`
  - `executeDraw` と同じ計算をするが、一切保存しない(デモ・リハーサル用)。
- `getLastPrizeCount()`
  - `{ total, remaining }`。`remaining` が 0 になったら「おしまい」。

保存先は IndexedDB(localforage、DB 名 `jackpot-game`)。デモ(`?demo=1` / デモセッション)は別ストア(`:demo` 付き)を使うので本番データを汚さない。

## 確変

- 抽選開始時に一度だけ、景品数に応じて確変の回(`calculateKakuhenTimings`。通常抽選用に最低 1 件は残すため、景品 1 件では確変なし)と、その回に当てる景品の予約を作る(`wonMember: null` の予約結果として保存)。
- 予約済みの景品は通常抽選では引かれない(後の確変で重複当選しないため)。確変の回に予約から 1 件を選んで確定する。
- UI は確変のとき、最終景品をルーレット上に 2 回(画像1・画像2)並べ、2 回に分けて同じ景品へ止める(occurrence で別の扇に止める)。

## 演出画面(`ui/pages/main-draw`)

- 進行は `ActionQueue` のステップ列。ホストの Enter か、管理端末の「次へ」で 1 ステップずつ進む。
- 共通テーマ(ラスベガス金×赤)は `ui/theme/jackpot-theme.css`、紙吹雪は `ui/components/jackpot-confetti.vue`。当選・おしまい・半分ダイアログ、結果画面、抽選の舞台はこれを使う。`prefers-reduced-motion` では動きを止める。
- 画像が無い賞品は、ルーレットの扇とダイアログに賞品名を表示する。

## テスト

- ユニット: `npm test -w @octopus/game-jackpot`。人数 × 景品数のマトリクス(`draw-full-run.spec.ts`)で、全員・全景品を引き切っても例外・重複が出ないことを確認している。
- 画面の通し: `npm run build && npm run e2e -- ui`(`e2e/ui/jackpot-*.spec.ts`)。
  - `jackpot-scale`: 規模別(1×1 〜 300×100、ルーレット/スロット)にホスト画面を最後まで進め、例外・はみ出し・賞品名表示・結果画面を確認する。`E2E_SHOTS=<dir>` を付けると各段階のスクリーンショットを保存する。
  - `jackpot-screens`: 全画面を開いて例外・横スクロールが無いことを確認する。
  - `jackpot-flow`: ホスト・管理・参加者の 3 端末での遠隔進行。
