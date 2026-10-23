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

### 抽選の対象(`DrawPoolProvider`)

メンバー抽選の候補は、既定では名簿の全メンバー。外から絞り込めるよう、`DrawPoolProvider`(`getEligibleMemberIds(): Promise<string[] | null>`)という口を持つ。アプリのホストが `setDrawPoolProvider` で実装を渡す(例: イベントにエントリーした人だけ。参加者ポータルの `event-host.ts`)。

- `null` なら絞り込まない。配列なら、**候補にもリールのダミーにも、その中のメンバーだけ**を使う。名簿に無いIDは無視する。
- 対象が空、または対象の全員が当選済みなら `NoEligibleMembersError`(理由つきのメッセージ)で止める。
- 実装が例外を投げたら、そのまま抽選を失敗させる(**全メンバーにフォールバックしない**。対象外の人が当選する事故を防ぐため)。
- `previewDraw` も同じ対象を使う。

### 抽選の状態(`DrawStore`)

当選者・景品の在庫・確変の予定は、`DrawStore`(`control/draw/draw-store.ts`)が持つ。

- `SessionDrawStore`: セッションのホストとして接続しているとき。**セッションの結果ファイル(サーバー)が正本**で、同じセッションの中では、イベントを跨いでも同じ人・同じ景品は二度当たらない。リセットは管理画面の「結果をリセット」(`resetJackpot`)か、セッション/R2 のリセット。読み込んだ内容はメモリに持ち、通信は 画面を開いたとき・抽選の前・commit・reveal・予定の保存だけ(GAS は1回の通信が重い)。
- `RehearsalDrawStore`: セッションの外で動かしたとき、デモ(`?demo=1` / デモセッション)。メモリだけ(画面に「リハーサル（結果は保存されません）」と出る)。サーバーにも本番にも残らない。
- 抽選は「結果を確定(commit)→ 演出 → 当選者と景品が見えた時点で公開(reveal)」。確定できてから演出を始める。画面を開いたとき、確定済みで未公開の抽選があれば、引き直さずに同じ結果で演出し直す(`resumeDraw`)。

## 確変

- セッションで最初の抽選のときに一度だけ、景品数に応じて確変の回(`calculateKakuhenTimings`。通常抽選用に最低 1 件は残すため、景品 1 件では確変なし)と、その回に当てる景品の取り置きを決め、確変の予定(`plan`)として保存する。
- 取り置いた景品は通常抽選では引かれない(後の確変で重複当選しないため)。確変の回(「確定済みの件数 + 1」回目)に、取り置きの中から 1 件を選び、新しい drawId で確定する。サーバーも、確変の抽選に取り置き以外・通常の抽選に取り置きの景品が選ばれたら断る。
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
