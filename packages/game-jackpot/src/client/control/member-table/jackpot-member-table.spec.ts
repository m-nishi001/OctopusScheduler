import { describe, expect, it, vi } from "vitest";
import { exportRoster, previewRosterImport } from "@octopus/accounts";
import type { Member, RosterImportRepository } from "@octopus/accounts";
import { exportTable, parseTable, planImport } from "@octopus/table-io";
import { installMediaTestEnv } from "../../testing/media-test-utils";
import { jackpotMemberAdapter, JACKPOT_MEMBER_HEADERS, jackpotMemberTable } from "./jackpot-member-table";
import type { JackpotMemberRow } from "./jackpot-member-table";

installMediaTestEnv();

const csvFile = (text: string) => new File([text], "jackpot-members.csv", { type: "text/csv" });
const people: Member[] = [
  { id: "m1", name: "アリス" },
  { id: "m2", name: "ボブ" },
  { id: "admin", name: "管理者", isAdmin: true },
];

/** 名簿の窓口と、メンバーの拡張設定の窓口の偽物。呼ばれた内容を記録する。 */
function fakes(extras: Record<string, { rank: number; weight?: number }> = {}) {
  const roster: { upserts: { id?: string; name: string; photo?: string }[]; deleteIds: string[] }[] = [];
  const repo: RosterImportRepository = {
    listMembers: async () => people,
    existsMemberPhotos: async () => [],
    putMemberPhoto: async () => undefined,
    applyRoster: async (args) => {
      roster.push(args as never);
      return { upserted: args.upserts.length, deleted: args.deleteIds.length };
    },
  };
  const setExtras = vi.fn(async (_rows: { id: string; rank?: number; weight?: number }[]) => ({ updated: 0, unknown: [] as string[] }));
  const port = { readExtras: async () => new Map(Object.entries(extras)), setExtras };
  return { repo, roster, setExtras, table: jackpotMemberTable(port) };
}

const preview = async (csv: string, env: ReturnType<typeof fakes>) => {
  const p = await previewRosterImport({ table: csvFile(csv), media: [], mode: "upsert" }, { repo: env.repo }, env.table);
  if (!p.ok) throw new Error(p.errors.join());
  return p;
};

describe("jackpotMemberTable", () => {
  it("書き出した CSV(ランク・当選しやすさの列つき)をそのまま取り込むと、全行が変更なし。何も書かない", async () => {
    const env = fakes({ m1: { rank: 2, weight: 30 } });
    const out = await exportRoster(people, { includeMedia: false }, { ensure: async () => undefined, get: () => undefined }, env.table);
    expect(out.filename).toBe("jackpot-members.csv");
    const text = new TextDecoder().decode(out.bytes);
    expect(text).toContain("ランク");
    expect(text).toContain("当選しやすさ");
    const p = await preview(text, env);
    expect(p.plan.counts).toEqual({ add: 0, update: 0, unchanged: 3, delete: 0, error: 0 });
    await p.apply();
    expect(env.roster).toEqual([]);
    expect(env.setExtras).not.toHaveBeenCalled();
  });

  it("ランク・当選しやすさだけの変更は、名簿に書かず、拡張設定を1回で書く。空のセルはいまのまま", async () => {
    const env = fakes({ m1: { rank: 2, weight: 30 }, m2: { rank: 5 } });
    const p = await preview("ID,名前,ランク,当選しやすさ\nm1,,3,\nm2,ボブ,,80\n", env);
    expect(p.plan.counts).toMatchObject({ update: 2, add: 0, error: 0 });
    await p.apply();
    expect(env.roster).toEqual([]);
    expect(env.setExtras).toHaveBeenCalledTimes(1);
    expect(env.setExtras).toHaveBeenCalledWith([
      { id: "m1", rank: 3, weight: 30 },
      { id: "m2", rank: 5, weight: 80 },
    ]);
  });

  it("名前を変えると名簿に書く(削除はしない)。名簿にいない ID は、名前があれば名簿に追加し、拡張設定も設定する", async () => {
    const env = fakes();
    const p = await preview("ID,名前,ランク\nm1,アリス改,\nnew1,新人,2\n", env);
    expect(p.plan.counts).toMatchObject({ update: 1, add: 1 });
    await p.apply();
    expect(env.roster).toEqual([{ upserts: [{ id: "m1", name: "アリス改", photo: undefined }, { id: "new1", name: "新人", photo: undefined }], deleteIds: [] }]);
    expect(env.setExtras).toHaveBeenCalledTimes(1);
    expect(env.setExtras.mock.calls[0][0]).toContainEqual({ id: "new1", rank: 2, weight: undefined });
  });

  it("名簿にいない ID で名前が無い行・範囲外のランクや当選しやすさはエラーで、取り込めない", async () => {
    const env = fakes();
    const p = await preview("ID,名前,ランク,当選しやすさ\nghost,,3,\nm1,,0,\nm2,,,101\nm1,,,\n", env);
    expect(p.plan.rows.map((r) => r.status)).toEqual(["error", "error", "error", "error"]);
    expect(p.plan.rows[0].message).toContain("名簿にない ID");
    expect(p.plan.rows[3].message).toContain("重複");
    await expect(p.apply()).rejects.toThrow();
    expect(env.roster).toEqual([]);
    expect(env.setExtras).not.toHaveBeenCalled();
  });

  it("旧書式 id,rank,weight の CSV もそのまま読める", () => {
    const parsed = parseTable(new TextEncoder().encode("id,rank,weight\nm1,3,40\n"), JACKPOT_MEMBER_HEADERS);
    if (!parsed.ok) throw new Error("parse");
    const current: JackpotMemberRow[] = [{ id: "m1", name: "アリス", rank: 5 }];
    const plan = planImport(current, parsed.rows, jackpotMemberAdapter(), "upsert");
    expect(plan.upserts[0]).toMatchObject({ id: "m1", name: "アリス", rank: 3, weight: 40 });
    expect(exportTable(plan.next, jackpotMemberAdapter()).split("\r\n")[1]).toBe("m1,アリス,,3,40");
  });
});
