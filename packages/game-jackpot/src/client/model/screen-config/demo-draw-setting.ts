/**
 * デモ抽選(練習抽選)の設定。説明と本抽選の間に、本番と同じルーレット/スロットで練習として回す。結果は記録せず、公開もしない。
 * OFF のときは、説明から本抽選へそのまま進む。
 */
export const MIN_DEMO_ROUNDS = 1;
export const MAX_DEMO_ROUNDS = 3;

export interface DemoDrawSettings {
  /** 練習抽選をするか。既定は ON。 */
  enabled: boolean;
  /** 練習で回す回数(1〜3)。 */
  rounds: number;
  /** 練習抽選を始めるまで流す BGM の素材の名前。 */
  bgm: string;
}

export const DEFAULT_DEMO_DRAW: DemoDrawSettings = { enabled: true, rounds: 1, bgm: "" };

/** 回数を 1〜3 の整数に収める。数でないときは既定(1回)。 */
export function clampDemoRounds(value: unknown): number {
  const n = typeof value === "string" && value.trim() !== "" ? Number(value) : value;
  if (typeof n !== "number" || !Number.isFinite(n)) return DEFAULT_DEMO_DRAW.rounds;
  return Math.min(MAX_DEMO_ROUNDS, Math.max(MIN_DEMO_ROUNDS, Math.round(n)));
}

/** 保存されている設定(`demo-screen-settings`)を読む。無い・形が違う項目は既定。 */
export function parseDemoDrawSettings(raw: unknown): DemoDrawSettings {
  if (typeof raw !== "object" || raw === null) return { ...DEFAULT_DEMO_DRAW };
  const r = raw as { enabled?: unknown; rounds?: unknown; bgm?: unknown };
  return {
    enabled: typeof r.enabled === "boolean" ? r.enabled : DEFAULT_DEMO_DRAW.enabled,
    rounds: clampDemoRounds(r.rounds),
    bgm: typeof r.bgm === "string" ? r.bgm : "",
  };
}
