# ルーレット仕様書

（抽出元: `useRouletteAnimation` 実装 + `roulette-animation-logic.spec.ts` テスト）

---

## 概要

- `useRouletteAnimation(props, emit)` はルーレット描画・再生を担う Vue フック。
- 提供 API: `canvas`, `startSpin`, `stopSpin`, `spinning`。
- 画像読み込み、スピン（RAF による更新）、3秒の減速アニメ、BGM 制御、停止後のイベント発火を行う。

---

## 参照ファイル

- 実装: `src/ui/pages/main-draw/roulette/roulette-animation-logic.ts`
- テスト: `src/ui/pages/main-draw/roulette/roulette-animation-logic.spec.ts`

---

## 公開 API

| 名称        |                                                   シグネチャ / 返却値 | 内容 / 副作用                                                                                           | 備考                                              |
| ----------- | --------------------------------------------------------------------: | ------------------------------------------------------------------------------------------------------- | ------------------------------------------------- |
| `canvas`    |                                      `ref<HTMLCanvasElement \| null>` | 描画対象の canvas 参照                                                                                  | -                                                 |
| `startSpin` |                     `async (bgm1Url?: Blob \| null) => Promise<void>` | BGM を停止→読み込み→ループ再生し、`spinning` を true にして RAF ループを開始                            | 音声エラーは無視される                            |
| `stopSpin`  | `(_opts?: { decelerationFunction?: ... }) => Promise<string \| null>` | 選択済み賞に合わせて減速・整列し、最終的に `emit('stopped', prizeId)` を発火。Promise は prizeId を返す | `props.selectedPrize` が falsy の場合は即時 throw |
| `spinning`  |                                                        `Ref<boolean>` | 現在スピン中かを示す                                                                                    | -                                                 |

注: `runAutoReroll` 型は存在するが実装は見当たらない（未実装）。

---

## 描画・セクター配置ルール

- セクター数: `sectors = Math.max(8, props.prizes.length)`（最低 8）
- 1 セクター角度: `sectorAngle = 2π / sectors`（ラジアン）
- 画像読み込み優先順:
  1. `prize.imageAssetId`（アセット ID。クライアントはこれを用いて AssetService から画像を取得する）
  2. `prize.imageAssetId` → `AssetDataService#getAssetDataById` → blob → `URL.createObjectURL`
  3. デフォルト SVG data URL（フォールバック）
- 画像は内側リング（innerRadius..outerRadius）に合わせてスケーリング・回転して描画される。

---

## 回転（内部表現）

- 内部変数 `rotation` はラジアンで保持。
- 表示更新は requestAnimationFrame により行われる。フレーム時間正規化に `FRAME_REF_MS = 1000 / 60` を使用。
- `accelerate`（スピン中）は `initialSpeed = 0.2` を用い、時間差（delta）に応じて rotation を加算。演出として `fluctuation` を少し加える。

---

## スピン開始: `startSpin(bgm1Url?)`

- BGM が与えられた場合: 既存 BGM を stop → load → play(isRepeat: true)
- `spinning.value = true`、`lastTimestamp = performance.now()` を設定して RAF を起動。初期速度 0.2 を使用。

---

## 停止処理: フロー詳細（`stopSpin`）

1. 同期検証: `props.selectedPrize` が無ければ `throw Error("selectedPrize is required for stopSpin")`。
2. `now = performance.now()` を取得し、`lastTimestamp` があれば差分を加算して回転を補正。
3. `targetIndex = props.prizes.findIndex(p => p.id === props.selectedPrize.id)`（見つからなければ -1）。
4. 目標角度算出:
   - `sectorCenter = sectorAngle / 2`
   - `randomOffset = sectorCenter + (Math.random() - 0.5) * (sectorAngle / 2)`（セクター中央の ± sectorAngle/4 範囲）
   - `targetRotation = (targetIndex >= 0) ? -(targetIndex * sectorAngle + randomOffset) + Math.PI/2 : rotation`
     - 配列に存在すればそのセクター中心付近に整列
     - 存在しなければ位置合わせは行わない（`rotation` のまま）
5. 現在の RAF を cancel して `decelerate(...)` を呼ぶ（duration = 3 秒）
6. `decelerate` が完了したら `stopBgm()` を呼び、`finally` 内で `setTimeout(..., 1000)` により 1 秒後に `emit('stopped', prizeId)` を発火し Promise を解決する。

---

## 定数 / タイミング

| 名称             |                      値 | 説明                                   |
| ---------------- | ----------------------: | -------------------------------------- |
| 最低セクター数   | `max(8, prizes.length)` | 賞が少なくても 8 セクターで表示        |
| セクター角度     |          `2π / sectors` | ラジアン                               |
| FRAME_REF_MS     |             `1000 / 60` | delta 正規化に利用                     |
| 初期速度         |                   `0.2` | start/stop での基準速度                |
| 減速アニメ時間   |                  `3` 秒 | `decelerate` の duration               |
| 停止後 emit 遅延 |               `1000` ms | stopBgm の完了後 setTimeout により待機 |

---

## イベント / 戻り値 / 例外

- `emit('stopped', prizeId)` は decelerate → stopBgm().finally → setTimeout(1000) の後に発火。
- `stopSpin()` は最終的に `Promise<string | null>` を返す（selectedPrize.id と同じ値で resolve）。
- `props.selectedPrize` が falsy の場合は同期的に `Error` を投げる。

---

## エッジケース / 実装上の挙動

| ケース                                       | 挙動                                                                                             | テスト注意点                                                                                    |
| -------------------------------------------- | ------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------- |
| `prizes.length < 8`                          | 残りはデフォルト画像で埋められる（sectors=8）                                                    | index とセクターの対応を検証すること                                                            |
| `props.selectedPrize` が null                | `stopSpin()` は即時 throw                                                                        | expect(() => stopSpin()).toThrowError(...) を使う                                               |
| `selectedPrize` が `prizes` に含まれない     | `targetRotation = rotation`（見た目は動かない）、だが Promise は渡した ID で resolve/emit される | テストは返り値と emit の ID を検証する                                                          |
| 非同期チェーン（stopBgm→finally→setTimeout） | `decelerate` 解決後さらに 1s の setTimeout がある。                                              | `vi.useFakeTimers()` を使用する場合は microtask を flush してから timer を advance/run すること |
| Vue ライフサイクル                           | `onMounted`/`onUnmounted` を使用しているため、直接フックを呼ぶと Vue の警告が出る                | テストは小さなコンポーネントに組み込んで mount するか、ライフサイクル API をモックする          |

---

## テスト実務アドバイス（失敗事例から）

- `decelerate` は内部で RAF を使って 3 秒で終了する。テストは RAF を同期モックする必要がある（サンプルでは `requestAnimationFrame` を上書きして 1 回の呼び出しで 4000ms 進める仕組みを使っている）。
- `decelerate` 解決後に `stopBgm().finally(() => setTimeout(..., 1000))` のチェーンがあるため、マイクロタスクフラッシュ（`await Promise.resolve()` を 1-2 回）後に `vi.advanceTimersByTime(1000)` か `vi.runAllTimers()` を呼んでタイマーを進める必要がある。
- Vue のライフサイクル警告を避けたいなら、フックを含むダミーコンポーネントを `mount()` してテストする。

---

## 数値例（理解用）

- 例: `prizes.length = 3` → `sectors = 8`
  - `sectorAngle = 360° / 8 = 45°`
  - `sectorCenter = 22.5°`
  - `randomOffset` は `11.25° .. 33.75°` の範囲
  - 先頭 index = 0 の場合、`targetRotation`（度）= `-(0 * 45° + randomOffset) + 90°` 例: randomOffset=22.5° → 67.5°

---

## 改善候補（提案）

1. `stopSpin` にオプションで `emitDelayMs`（テスト時は 0）を渡せるようにしてテストを簡潔にする。
2. `runAutoReroll` を実装するか、未実装であれば型から削除。
3. テストはライフサイクル警告を避けるため、`mount` ベースに改修する。

---

## チェックリスト（テストを書く時）

- [ ] `vi.useFakeTimers()` を使うならマイクロタスクを `await Promise.resolve()` でフラッシュ
- [ ] RAF を同期化して `decelerate` の進行を制御
- [ ] `vi.runAllTimers()` または `vi.advanceTimersByTime(1000)` で最終 setTimeout を実行
- [ ] Vue のライフサイクルが必要なら小さなコンポーネントにフックを移して `mount()` する

---

_作成日: 2025-11-08_  
_生成元: 実装ファイル `roulette-animation-logic.ts` とテスト `roulette-animation-logic.spec.ts` の解析結果_
