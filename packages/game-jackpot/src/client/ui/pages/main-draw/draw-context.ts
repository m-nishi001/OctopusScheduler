import type { DrawApplicationService } from "@control/draw/draw-application-service";
import type { DrawPrizeResponse } from "@control/draw/dto/draw-prize-response";
import type { DrawResultDto } from "@control/draw/dto/draw-result-dto";
import type { PrizeDto } from "@control/prize/dto/prize-dto";
import type { RouletteItem } from "./roulette/roulette-image-loader";
import type { RoulettePrizeDto } from "./roulette/roulette-prize-preparer";

interface Readable<T> {
  readonly value: T;
}
interface Writable<T> {
  value: T;
}

/**
 * 抽選の進行ステップが触る画面の状態とサービス。
 * ステップは ctx だけを見て動くので、Vue のコンポーネントを立てなくても単体テストできる。
 */
export interface DrawContext {
  drawService: Pick<DrawApplicationService, "getLastPrizeCount">;
  /** 画面の段階("member" = メンバー抽選, "prize" = 景品抽選)。 */
  phase: Writable<string>;
  /** 今回の抽選結果。抽選に失敗したときは null。 */
  result: Writable<DrawResultDto | null>;
  /** 今回の抽選で、ルーレットに流す景品の内訳。 */
  prizeRes: Readable<DrawPrizeResponse | null>;
  prizes: Readable<PrizeDto[]>;
  selectedPrize: Readable<PrizeDto | null>;
  setSelectedPrize(prize: PrizeDto | null): void;
  preparePrizes(prizes: RoulettePrizeDto[]): Promise<RouletteItem[]>;
  loadBgmBlob(name: string | null): Promise<Blob | null>;
  /** メンバー抽選・景品抽選の演出コンポーネント(テンプレート ref)。 */
  memberAnim: Readable<any>;
  prizeAnim: Readable<any>;
  showPrizeWinningDialog: Writable<boolean>;
  showHalfRemainingDialog: Writable<boolean>;
  /** 確変メッセージのオーバーレイ。 */
  kakuhenOverlayVisible: Writable<boolean>;
  /** 景品抽選で、停止から最後の景品が止まるまでの長さ(秒)。管理画面の設定。スロット・ルーレット共通(確変は対象外)。 */
  prizeStopSec: number;
  /** 演出の待ち(秒)。省略すると実際に待つ。テストで差し替える。 */
  wait?: (seconds: number) => Promise<void>;
}

/** 抽選の進行に必要な状態が足りない(想定外)。握りつぶさず、原因が分かる名前で止める。 */
export class DrawStateError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DrawStateError";
  }
}

/** 抽選された景品を返す。まだ抽選が済んでいなければ `DrawStateError`。 */
export function requireSelectedPrize(ctx: DrawContext): PrizeDto {
  const prize = ctx.selectedPrize.value;
  if (!prize) throw new DrawStateError("抽選された景品がありません(抽選が完了していません)");
  return prize;
}
