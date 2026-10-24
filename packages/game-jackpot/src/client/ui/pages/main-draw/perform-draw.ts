import type { DrawApplicationService } from "@control/draw/draw-application-service";
import type { DrawMemberResponse } from "@control/draw/dto/draw-member-response";
import type { DrawPrizeResponse } from "@control/draw/dto/draw-prize-response";
import type { DrawResultDto } from "@control/draw/dto/draw-result-dto";
import type { PrizeDto } from "@control/prize/dto/prize-dto";
import { DrawStateError } from "./draw-context";
import type { DrawProgress } from "@control/draw/dto/draw-progress";
import type { RouletteItem } from "./roulette/roulette-image-loader";
import type { RoulettePrizeDto } from "./roulette/roulette-prize-preparer";

/**
 * ルーレットに流す景品を並べる。当選景品を1つ、ダミー当選景品、ダミー景品の順。
 * 同じ景品が重複しても1枠ずつ見せたいので、ダミーは見た目用の一意なIDを付けた複製にする
 * (元の景品は originalPrizeId に残す)。
 */
export function buildPrizesToPrepare(prizes: PrizeDto[], prizeRes: DrawPrizeResponse): RoulettePrizeDto[] {
  const shown: RoulettePrizeDto[] = [];

  const winner = prizes.find((p) => p.id === prizeRes.winnerPrizeId);
  if (winner) shown.push(winner);

  const dummyWinner = prizes.find((p) => p.id === prizeRes.dummyWinnerPrizeId);
  if (dummyWinner && dummyWinner.id !== prizeRes.winnerPrizeId) {
    shown.push({ ...dummyWinner, id: `${dummyWinner.id}#dummy-winner`, originalPrizeId: dummyWinner.id });
  }

  prizeRes.dummyPrizeIds.forEach((id, idx) => {
    const p = prizes.find((x) => x.id === id);
    if (p) shown.push({ ...p, id: `${p.id}#dup-${idx}`, originalPrizeId: p.id });
  });

  return shown;
}

export interface PerformDrawDeps {
  drawService: Pick<DrawApplicationService, "drawNext" | "resumeDraw">;
  prizes: { readonly value: PrizeDto[] };
  /**
   * ルーレットに描く形(画像の URL つき)にする。**画面には反映しない**(裏で先に用意しても、いま見えている景品を壊さないため)。
   * 反映は、そのサイクルを始めるときに呼び出し側が行う。
   */
  buildPrizeItems(prizes: RoulettePrizeDto[]): Promise<RouletteItem[]>;
}

export interface DrawOutcome {
  result: DrawResultDto;
  prizeRes: DrawPrizeResponse;
  memberRes: DrawMemberResponse;
  /** 当選した景品(景品一覧にある完全な情報)。 */
  winner: PrizeDto;
  /** ルーレットに描く景品(画像の URL つき)。使わずに捨てるときは revokePreparedPrizes で URL を破棄する。 */
  prizeItems: RouletteItem[];
}

/** 続けられるかの確認と、続けられるなら抽選・確定・ルーレットの材料まで済ませた結果。 */
export type NextCycleResult =
  | { kind: "finished"; progress: DrawProgress }
  | { kind: "draw"; outcome: DrawOutcome };

/**
 * 続けられるか確かめ(景品・メンバーが尽きていれば終了を返す)、続けられるなら抽選して結果を保存先に確定(commit)し、
 * ルーレットの材料まで用意する。演出は、これが成功してから始める。失敗したら例外を投げる(状態は呼び出し側が反映する)。
 */
export async function performNext(deps: PerformDrawDeps): Promise<NextCycleResult> {
  const next = await deps.drawService.drawNext({ memberRequestCount: 10, prizeRequestCount: 8 });
  if (next.kind === "finished") return next;
  return { kind: "draw", outcome: await prepareOutcome(deps, next.outcome) };
}

/**
 * 確定済みで未公開の抽選(ホストの再読み込みなどで演出が途中だったもの)を、引き直さずに同じ結果で演出し直す材料を用意する。
 */
export async function performResume(deps: PerformDrawDeps, pending: DrawResultDto): Promise<DrawOutcome> {
  return prepareOutcome(deps, await deps.drawService.resumeDraw(pending, { memberRequestCount: 10, prizeRequestCount: 8 }));
}

async function prepareOutcome(
  deps: PerformDrawDeps,
  { result, prizeRes, memberRes }: { result: DrawResultDto; prizeRes: DrawPrizeResponse; memberRes: DrawMemberResponse }
): Promise<DrawOutcome> {
  const winnerId = result.wonPrize?.id;
  const winner = winnerId ? deps.prizes.value.find((p) => p.id === winnerId) : undefined;
  if (!winner) throw new DrawStateError("当選した景品が景品一覧に見つかりません");

  const prizeItems = await deps.buildPrizeItems(buildPrizesToPrepare(deps.prizes.value, prizeRes));
  return { result: { ...result, wonPrize: winner }, prizeRes, memberRes, winner, prizeItems };
}
