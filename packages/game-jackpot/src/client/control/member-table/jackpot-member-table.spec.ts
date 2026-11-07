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
function fakes(extras: Record<string, { weight?: number }> = {}) {
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
  const setExtras = vi.fn(async (_rows: { id: string; weight?: number }[]) => ({ updated: 0, unknown: [] as string[] }));
  const port = { readExtras: async () => new Map(Object.entries(extras)), setExtras };
  return { repo, roster, setExtras, table: jackpotMemberTable(port) };
}

const preview = async (csv: string, env: ReturnType<typeof fakes>) => {
  const p = await previewRosterImport({ table: csvFile(csv), media: [], mode: "upsert" }, { repo: env.repo }, env.table);
  if (!p.ok) throw new Error(p.errors.join());
  return p;
};

describe("jackpotMemberTable", () => {
  it("書き出した CSV(当選しやすさの列つき)をそのまま取り込むと、全行が変更なし。何も書かない", async () => {
    const env = fakes({ m1: { weight: 3 } });
    const out = await exportRoster(people, { includeMedia: false }, { ensure: async () => undefined, get: () => undefined }, env.table);
    expect(out.filename).toBe("jackpot-members.csv");
    const text = new TextDecoder().decode(out.bytes);
    expect(text).not.toContain("ランク");
    expect(text).toContain("当選しやすさ");
    const p = await preview(text, env);
    expect(p.plan.counts).toEqual({ add: 0, update: 0, unchanged: 3, delete: 0, error: 0 });
    await p.apply();
    expect(env.roster).toEqual([]);
    expect(env.setExtras).not.toHaveBeenCalled();
  });

  it("当選しやすさだけの変更は、名簿に書かず、拡張設定を1回で書く。空のセルはいまのまま", async () => {
    const env = fakes({ m1: { weight: 3 }, m2: { weight: 5 } });
    const p = await preview("ID,名前,当選しやすさ\nm1,,7\nm2,ボブ,\n", env);
    expect(p.plan.counts).toMatchObject({ update: 1, unchanged: 1, add: 0, error: 0 });
    await p.apply();
    expect(env.roster).toEqual([]);
    expect(env.setExtras).toHaveBeenCalledTimes(1);
    expect(env.setExtras).toHaveBeenCalledWith([{ id: "m1", weight: 7 }]);
  });

  it("名前を変えると名簿に書く(削除はしない)。名簿にいない ID は、名前があれば名簿に追加し、拡張設定も設定する", async () => {
    const env = fakes();
    const p = await preview("ID,名前,当選しやすさ\nm1,アリス改,\nnew1,新人,2\n", env);
    expect(p.plan.counts).toMatchObject({ update: 1, add: 1 });
    await p.apply();
    expect(env.roster).toEqual([{ upserts: [{ id: "m1", name: "アリス改", photo: undefined }, { id: "new1", name: "新人", photo: undefined }], deleteIds: [] }]);
    expect(env.setExtras).toHaveBeenCalledTimes(1);
    expect(env.setExtras.mock.calls[0][0]).toContainEqual({ id: "new1", weight: 2 });
  });

  it("名簿にいない ID で名前が無い行・範囲外の当選しやすさ(0・11)はエラーで、取り込めない", async () => {
    const env = fakes();
    const p = await preview("ID,名前,当選しやすさ\nghost,,3\nm1,,0\nm2,,11\nm1,,\n", env);
    expect(p.plan.rows.map((r) => r.status)).toEqual(["error", "error", "error", "error"]);
    expect(p.plan.rows[0].message).toContain("名簿にない ID");
    expect(p.plan.rows[3].message).toContain("重複");
    await expect(p.apply()).rejects.toThrow();
    expect(env.roster).toEqual([]);
    expect(env.setExtras).not.toHaveBeenCalled();
  });

  it("旧書式 id,rank,weight の CSV も読める(廃止したランクの列は無視する)", () => {
    const parsed = parseTable(new TextEncoder().encode("id,rank,weight\nm1,3,4\n"), JACKPOT_MEMBER_HEADERS);
    if (!parsed.ok) throw new Error("parse");
    const current: JackpotMemberRow[] = [{ id: "m1", name: "アリス" }];
    const plan = planImport(current, parsed.rows, jackpotMemberAdapter(), "upsert");
    expect(plan.upserts[0]).toMatchObject({ id: "m1", name: "アリス", weight: 4 });
    expect(plan.upserts[0]).not.toHaveProperty("rank");
    expect(exportTable(plan.next, jackpotMemberAdapter()).split("\r\n")[1]).toBe("m1,アリス,4");
  });

  it("書き出しに写真の列は無い(ジャックポットのメンバーは写真を持たない)", async () => {
    const env = fakes({ m1: { weight: 3 } });
    const out = await exportRoster(people, { includeMedia: false }, { ensure: async () => undefined, get: () => undefined }, env.table);
    const header = new TextDecoder().decode(out.bytes).replace(/^\uFEFF/, "").split("\r\n")[0];
    expect(header).toBe("ID,名前,当選しやすさ");
    expect(JACKPOT_MEMBER_HEADERS.map((h) => h.key)).not.toContain("photo");
  });

  it("古い書き出しの「写真」列は無視する。画像が無くてもエラーにならず、名簿の写真は変えない", async () => {
    const env = fakes({ m1: { weight: 2 } });
    const p = await preview("ID,名前,写真,ランク,当選しやすさ\nm1,アリス,missing.png,4,6\n", env);
    expect(p.plan.rows[0].status).toBe("update");
    await p.apply();
    expect(env.roster).toEqual([]);
    expect(env.setExtras).toHaveBeenCalledWith([{ id: "m1", weight: 6 }]);
  });
});
