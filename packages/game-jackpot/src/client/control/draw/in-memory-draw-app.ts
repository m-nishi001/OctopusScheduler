import { DrawApplicationService } from "./draw-application-service";
import { DrawResultService } from "./draw-result-service";
import { DrawStateInitializer } from "./draw-state-initializer";
import type { DrawResultDto } from "./dto/draw-result-dto";
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
  /** これまでに保存された抽選結果（予約済みの確変の枠を含む）。 */
  results: DrawResultDto[];
}

/**
 * メモリ上だけで動く抽選一式を作る。本番と同じ抽選ロジック（DrawApplicationService など）を使うが、
 * メンバー・景品・抽選結果・確変の状態はすべてこの中に閉じていて、ブラウザの保存領域にも、
 * サーバーへの同期にも、DI コンテナにも触れない。
 * シミュレーションと、通しのテストで使う。
 */
export function createInMemoryDrawApp(options: InMemoryDrawOptions): InMemoryDrawApp {
  const random: MathRandomProvider = options.random ?? new MathRandomProvider();
  const members = options.members.map((m) => ({ ...m }));
  const prizes = options.prizes.map((p) => ({ ...p }));

  const results: DrawResultDto[] = [];
  let kakuhenState: number[] | null = null;
  let nextId = 0;

  // 以下の「保存先」は、本番のリポジトリと同じメソッドだけをメモリ上で実装したもの。
  const resultRepository = {
    getDrawResults: async () => results.map((r) => ({ ...r })),
    getDrawResultById: async (id: string) => results.find((r) => r.drawId === id) ?? null,
    addDrawResult: async (r: DrawResultDto) => void results.push(r),
    updateDrawResult: async (r: DrawResultDto) => {
      const index = results.findIndex((x) => x.drawId === r.drawId);
      if (index < 0) throw new Error(`draw result not found: ${r.drawId}`);
      results[index] = r;
    },
    deleteDrawResult: async (id: string) => {
      const index = results.findIndex((x) => x.drawId === id);
      if (index >= 0) results.splice(index, 1);
    },
    syncDrawResults: async () => ({ synced: 0 }),
  };
  const stateRepository = {
    getState: async () => kakuhenState,
    saveState: async (state: number[]) => void (kakuhenState = state),
    clearState: async () => void (kakuhenState = null),
  };
  const idGenerator = { nextId: () => `sim-${nextId++}` };

  const selector = new WeightedSelector(random);
  const resultService = new DrawResultService(resultRepository as never);
  const initializer = new DrawStateInitializer(
    new PrizeReservationService(random),
    resultService,
    stateRepository as never,
    idGenerator as never
  );
  const app = new DrawApplicationService(
    { getMembers: async () => members.map((m) => ({ ...m })) } as never,
    { getPrizes: async () => prizes.map((p) => ({ ...p })) } as never,
    resultService,
    stateRepository as never,
    new MemberDrawService(selector, random),
    new PrizeDrawService(selector, random),
    idGenerator as never,
    initializer,
    options.pool ?? new AllMembersDrawPool()
  );
  return { app, results };
}
