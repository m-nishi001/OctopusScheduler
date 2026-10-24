import type { DrawApplicationService } from "@control/draw/draw-application-service";
import type { DrawMemberResponse } from "@control/draw/dto/draw-member-response";
import type { DrawPrizeResponse } from "@control/draw/dto/draw-prize-response";
import type { DrawResultDto } from "@control/draw/dto/draw-result-dto";
import type { PrizeDto } from "@control/prize/dto/prize-dto";
import { DrawStateError } from "./draw-context";
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
  drawService: Pick<DrawApplicationService, "executeDraw" | "resumeDraw">;
  prizes: { readonly value: PrizeDto[] };
  preparePrizes(prizes: RoulettePrizeDto[]): Promise<unknown>;
}

export interface DrawOutcome {
  result: DrawResultDto;
  prizeRes: DrawPrizeResponse;
  memberRes: DrawMemberResponse;
  /** 当選した景品(景品一覧にある完全な情報)。 */
  winner: PrizeDto;
}

/**
 * 抽選して結果を保存先に確定(commit)し、ルーレットの用意まで済ませる。演出は、これが成功してから始める。
 * 失敗したら例外を投げる(状態は呼び出し側が反映する)。
 */
export async function performDraw(deps: PerformDrawDeps): Promise<DrawOutcome> {
  return prepareOutcome(deps, await deps.drawService.executeDraw({ memberRequestCount: 10, prizeRequestCount: 8 }));
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

  await deps.preparePrizes(buildPrizesToPrepare(deps.prizes.value, prizeRes));
  return { result: { ...result, wonPrize: winner }, prizeRes, memberRes, winner };
}
