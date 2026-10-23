import { createFakeHubApi, makeDevice, makeHub } from "@octopus/session-hub/testing";
import type { Device, FaultInjector, TestHub } from "@octopus/session-hub/testing";
import { MemoryDeviceStore, SessionAdminRepository } from "@octopus/session-hub";
import { ENTRY_OPTIONS, entryRoundKey } from "@octopus/session-hub";
import type { ClientInput, JackpotDrawInput, JackpotPublished, PortalEvent, QuizRoundResult } from "@octopus/session-hub";

export { makeDevice, makeHub };
export type { Device, TestHub };

/** 管理者(admin1)として、セッションを作ってポータルに公開し、ホスト端末を接続した環境。 */
export async function portalEnv(options: { publish?: boolean } = {}) {
  const hub = makeHub();
  const admin = new SessionAdminRepository(createFakeHubApi(hub, "admin1"));
  const meta = await admin.create({ name: "受付会場" });
  if (options.publish ?? true) await admin.setPortalSession(meta.id, true);
  const host = makeDevice(hub, { memberId: "admin1" });
  await host.conn.joinOperator({ sessionId: meta.id, role: "host", label: "PC" });
  // ホストは、機能ごとの状態（event / quiz / jackpot …）を名前空間ごとに合成して公開する（本番の HostAgent と同じ）。
  const slices: Record<string, unknown> = {};
  let clientInput: ClientInput[] = [];
  const setSlice = (ns: string, value: unknown | null, input?: ClientInput[]): Promise<void> => {
    if (value === null) delete slices[ns];
    else slices[ns] = value;
    if (input) clientInput = input;
    return host.conn.publish({ ...slices }, clientInput);
  };
  return {
    hub,
    admin,
    meta,
    host,
    /** ホストが「イベント発生中」を公開する/取り下げる(本番ではホストの event.start / event.end が行う)。 */
    publishEvent: (event: PortalEvent | null) => setSlice("event", event),
    /** ホストがエントリー受付を開始する（回答ラウンドを開き、イベントに受付中の印を付けて公開する）。 */
    openEntry: async (event: PortalEvent, resume = false): Promise<PortalEvent> => {
      const key = event.entry?.key ?? entryRoundKey(event.id);
      await host.conn.openEntryRound(key, [...ENTRY_OPTIONS], resume);
      const next = { ...event, entry: { key, open: true } };
      await setSlice("event", next);
      return next;
    },
    /** ホストがエントリー受付を締め切る。 */
    closeEntry: async (event: PortalEvent): Promise<PortalEvent> => {
      if (!event.entry) throw new Error("受付が始まっていません");
      await host.conn.closeRound(event.entry.key);
      const next = { ...event, entry: { ...event.entry, open: false } };
      await setSlice("event", next);
      return next;
    },
    /** ホストがクイズの出題を公開し、回答受付を開始する（本番ではクイズのホストが行う）。 */
    startQuiz: async (patch: Partial<QuizPublished> = {}, durationMs = 30_000): Promise<QuizPublished> => {
      const quiz: QuizPublished = { ...sampleQuizState(), ...patch };
      const { deadlineMs } = await host.conn.openRound(quiz.roundKey!, QUIZ_OPTIONS.map(({ no, text }) => ({ no, text })), durationMs);
      // 受付中でない状態を公開するテストでは、締切を指定（null）できる
      const published = { ...quiz, deadlineMs: patch.deadlineMs !== undefined ? patch.deadlineMs : deadlineMs };
      await setSlice("quiz", published);
      return published;
    },
    publishQuiz: (quiz: QuizPublished | null) => setSlice("quiz", quiz),
    /** ホストがジャックポットの状態と、参加者に許可する操作を公開する。 */
    publishJackpot: (jackpot: Partial<JackpotPublished> | null, input: ClientInput[] = []) =>
      setSlice("jackpot", jackpot, input),
    /**
     * ホストがクイズ1ラウンドの結果を保存し、更新番号を公開する(本番では HostAgent.recordQuizResult が行う)。
     * 返り値は保存後の rev。
     */
    saveQuizResult: async (result: QuizRoundResult): Promise<number> => {
      const rev = await host.conn.putQuizResult(result);
      await setSlice("results", { rev });
      return rev;
    },
    /** ホストがジャックポットの抽選結果を確定(commit)して公開(reveal)し、更新番号を公開する。 */
    saveJackpotDraw: async (draw: JackpotDrawInput): Promise<number> => {
      await host.conn.commitJackpotDraw(draw);
      const rev = await host.conn.revealJackpotDraw(draw.drawId);
      await setSlice("results", { rev });
      return rev;
    },
    /** ホストが抽選の結果と予定を消し、更新番号を公開する。 */
    resetJackpot: async (): Promise<number> => {
      const rev = await host.conn.resetJackpot();
      await setSlice("results", { rev });
      return rev;
    },
    /** 運営側が見るエントリー済みの一覧（メンバーID）。 */
    entrants: async (key: string): Promise<string[]> => (await host.conn.getAnswers(key)).answers.map((a) => a.memberId ?? "?"),
  };
}

/** ログイン済みの参加者の端末。保存先(store)を共有すると、同じブラウザのリロードを再現できる。 */
export function participantDevice(
  hub: TestHub,
  member: { id: string; name: string },
  options: { store?: MemoryDeviceStore; faults?: FaultInjector; connection?: { now?: () => number } } = {}
): Device {
  return makeDevice(hub, { memberId: member.id, memberName: member.name, store: options.store, faults: options.faults, connection: options.connection });
}

export const ALICE = { id: "alice", name: "アリス" };
export const BOB = { id: "bob", name: "ボブ" };
export { MemoryDeviceStore };

export const sampleEvent = (patch: Partial<PortalEvent> = {}): PortalEvent => ({
  id: "event-1",
  title: "ジャックポット抽選",
  startedAtMs: 1_700_000_000_000,
  ...patch,
});

/** ホストが公開するクイズの状態（game-quiz の QuizHostState と同じ形）。 */
export interface QuizPublished {
  page: "intro" | "entry" | "play" | "answer" | "result";
  quizId: string;
  title: string;
  roundKey: string | null;
  deadlineMs: number | null;
  phase: "idle" | "answering" | "closed";
  question: string | null;
  options: Array<{ no: number; text: string; color: string }>;
  correctNo: number | null;
  reveal: "revealing" | "finished" | null;
}

export const QUIZ_OPTIONS = [
  { no: 1, text: "りんご", color: "#ef4444" },
  { no: 2, text: "みかん", color: "#f59e0b" },
  { no: 3, text: "ぶどう", color: "#8b5cf6" },
];

export function sampleQuizState(): QuizPublished {
  return {
    page: "play",
    quizId: "qz1",
    title: "果物クイズ",
    roundKey: "qz1:live",
    deadlineMs: null,
    phase: "answering",
    question: "みかんはどれ?",
    options: QUIZ_OPTIONS,
    correctNo: null,
    reveal: null,
  };
}

export const sampleRound = (patch: Partial<QuizRoundResult> = {}): QuizRoundResult => ({
  roundKey: "qz1:live",
  quizId: "qz1",
  title: "果物クイズ",
  correctNo: 2,
  closedAtMs: 1_700_000_000_000,
  answeredCount: 3,
  correct: [
    { memberId: "alice", name: "アリス", sec: 1.2 },
    { memberId: "bob", name: "ボブ", sec: 2.4 },
  ],
  wrongMemberIds: ["carol"],
  ...patch,
});

export const sampleDraw = (patch: Partial<JackpotDrawInput> = {}): JackpotDrawInput => ({
  drawId: "d1",
  memberId: "alice",
  memberName: "アリス",
  prizeId: "p1",
  prizeName: "1等 ペア旅行券",
  isKakuhen: false,
  atMs: 1_700_000_100_000,
  ...patch,
});
