import { DrawApplicationService } from "./draw-application-service";
import { DrawStateInitializer } from "./draw-state-initializer";
import { RehearsalDrawStore } from "./rehearsal-draw-store";
import { MathRandomProvider } from "../../model/common/math-random-provider";
import { AllMembersDrawPool } from "../../model/draw/draw-pool";
import type { DrawPoolProvider } from "../../model/draw/draw-pool";
import { MemberDrawService } from "../../model/draw/member-draw-service";
import { PrizeDrawService } from "../../model/draw/prize-draw-service";
import { PrizeReservationService } from "../../model/draw/prize-reservation-service";
import { WeightedSelector } from "../../model/draw/weighted-selector";
import type { Member } from "../../model/member/member";
import type { Prize } from "../../model/prize/prize";

/** 乱数の供給元。本番は `Math.random`、再現したいときは決まった並びを返す実装を渡す。 */
export type DrawRandom = Pick<MathRandomProvider, "next" | "nextInt">;

export interface InMemoryDrawOptions {
  members: Member[];
  prizes: Prize[];
  /** 省略時は `Math.random`。 */
  random?: DrawRandom;
  /** 抽選の対象。省略時は全メンバー。 */
  pool?: DrawPoolProvider;
}

export interface InMemoryDrawApp {
  /** 本番と同じ抽選ロジック。保存先だけがメモリ上。 */
  app: DrawApplicationService;
  /** 抽選結果と確変の予定の置き場(メモリ上)。 */
  store: RehearsalDrawStore;
}

/**
 * メモリ上だけで動く抽選一式を作る。本番と同じ抽選ロジック（DrawApplicationService など）を使うが、
 * メンバー・景品・抽選結果・確変の予定はすべてこの中に閉じていて、ブラウザの保存領域にも、
 * サーバーへの同期にも、DI コンテナにも触れない。
 * シミュレーションと、通しのテストで使う。
 */
export function createInMemoryDrawApp(options: InMemoryDrawOptions): InMemoryDrawApp {
  const random: MathRandomProvider = options.random ?? new MathRandomProvider();
  const members = options.members.map((m) => ({ ...m }));
  const prizes = options.prizes.map((p) => ({ ...p }));
  const store = new RehearsalDrawStore();
  let nextId = 0;
  const idGenerator = { nextId: () => `sim-${nextId++}` };

  const selector = new WeightedSelector(random);
  const app = new DrawApplicationService(
    { getMembers: async () => members.map((m) => ({ ...m })) } as never,
    { getPrizes: async () => prizes.map((p) => ({ ...p })) } as never,
    { current: () => store },
    new MemberDrawService(selector, random),
    new PrizeDrawService(selector, random),
    idGenerator as never,
    new DrawStateInitializer(new PrizeReservationService(random)),
    options.pool ?? new AllMembersDrawPool()
  );
  return { app, store };
}
