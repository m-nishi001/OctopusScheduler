import { describe, expect, it, vi } from "vitest";
import { RateLimitedError } from "@octopus/infrastructures/interfaces";
import type { Member } from "../../../server/accounts-api-contract";
import { buildZip } from "@octopus/table-io";
import { previewRosterImport } from "./roster-import";
import type { RosterImportDeps } from "./roster-import";

const modeOf = { mode: "upsert" as const };
const csvFile = (text: string, name = "members.csv") => new File([text], name, { type: "text/csv" });
const imageFile = (name: string, content: string) => new File([content], name, { type: "image/png" });
/** 中身から決まる縮小結果(中身が同じなら同じハッシュになる)。 */
const encode = async (file: Blob) => ({ bytes: new Uint8Array(await file.arrayBuffer()), mime: "image/webp" });

function fakeRepo(initial: Member[] = []) {
  const stored = new Set<string>();
  const calls = { put: 0, exists: 0, replace: [] as { upserts: { id?: string }[]; deleteIds: string[] }[] };
  let inFlight = 0;
  let maxInFlight = 0;
  const repo = {
    listMembers: async () => initial,
    existsMemberPhotos: async (hashes: string[]) => {
      calls.exists++;
      return hashes.filter((h) => stored.has(h));
    },
    putMemberPhoto: vi.fn(async (hash: string, _dataUrl: string) => {
      calls.put++;
      maxInFlight = Math.max(maxInFlight, ++inFlight);
      await new Promise((r) => setTimeout(r, 5));
      inFlight--;
      stored.add(hash);
    }),
    applyRoster: async (args: { upserts: { id?: string }[]; deleteIds: string[] }) => {
      calls.replace.push(args);
      return { upserted: args.upserts.length, deleted: args.deleteIds.length };
    },
  };
  return { repo, calls, stored, maxInFlight: () => maxInFlight };
}
const deps = (repo: ReturnType<typeof fakeRepo>["repo"], extra: Partial<RosterImportDeps> = {}): RosterImportDeps => ({ repo, encode, ...extra });

const people = (n: number) => Array.from({ length: n }, (_, i) => ({ id: `m${i}`, name: `人${i}` }));
const csvOf = (list: { id: string; name: string }[]) => "ID,名前,写真\n" + list.map((p) => `${p.id},${p.name},${p.id}.png`).join("\n");

describe("previewRosterImport / apply", () => {
  it("プレビューでは何も送らず・書かない。確定すると写真を並列に送り、名簿は1回だけ書く", async () => {
    const list = people(40);
    const { repo, calls, maxInFlight } = fakeRepo();
    const preview = await previewRosterImport(
      { table: csvFile(csvOf(list)), media: list.map((p) => imageFile(`${p.id}.png`, `image-${p.id}`)), ...modeOf },
      deps(repo)
    );
    if (!preview.ok) throw new Error(preview.errors.join());
    expect(preview.plan.counts).toMatchObject({ add: 40, error: 0 });
    expect(calls.put + calls.replace.length).toBe(0);

    const stats = await preview.apply();
    expect(calls.exists).toBe(1);
    expect(calls.put).toBe(40);
    expect(calls.replace).toHaveLength(1);
    expect(calls.replace[0].upserts).toHaveLength(40);
    expect(maxInFlight()).toBe(6);
    expect(stats).toMatchObject({ added: 40, updated: 0, uploaded: 40, alreadyOnServer: 0, failedRows: 0, rateLimited: 0, maxConcurrentUploads: 6 });
  });

  it("名簿に書くのは全部の写真を送り終えてから。送信が失敗したら名簿は書かず、やり直せば続きから進む", async () => {
    const list = people(8);
    const { repo, calls, stored } = fakeRepo();
    const input = { table: csvFile(csvOf(list)), media: list.map((p) => imageFile(`${p.id}.png`, `image-${p.id}`)), ...modeOf };
    let failOnce = true;
    const original = repo.putMemberPhoto.getMockImplementation()!;
    repo.putMemberPhoto.mockImplementation(async (hash, dataUrl) => {
      if (failOnce && calls.put >= 4) {
        failOnce = false;
        throw new Error("network");
      }
      return original(hash, dataUrl);
    });
    const first = await previewRosterImport(input, deps(repo, { pool: { concurrency: 2 } }));
    if (!first.ok) throw new Error("preview");
    await expect(first.apply()).rejects.toThrow("network");
    expect(calls.replace).toHaveLength(0);
    const sentBefore = stored.size;
    expect(sentBefore).toBeGreaterThan(0);

    const second = await previewRosterImport(input, deps(repo));
    if (!second.ok) throw new Error("preview");
    const stats = await second.apply();
    expect(stats.alreadyOnServer).toBe(sentBefore);
    expect(stats.uploaded).toBe(8 - sentBefore);
    expect(calls.replace).toHaveLength(1);
  });

  it("429 は待ってやり直し、回数を数える。名簿は1回だけ書く", async () => {
    const list = people(6);
    const { repo, calls } = fakeRepo();
    const original = repo.putMemberPhoto.getMockImplementation()!;
    let limited = 2;
    repo.putMemberPhoto.mockImplementation(async (hash, dataUrl) => {
      if (limited-- > 0) throw new RateLimitedError("rate limited", 10);
      return original(hash, dataUrl);
    });
    const preview = await previewRosterImport(
      { table: csvFile(csvOf(list)), media: list.map((p) => imageFile(`${p.id}.png`, `image-${p.id}`)), ...modeOf },
      deps(repo, { pool: { sleep: async () => undefined } })
    );
    if (!preview.ok) throw new Error("preview");
    const stats = await preview.apply();
    expect(stats.rateLimited).toBe(2);
    expect(stats.uploaded).toBe(6);
    expect(calls.replace).toHaveLength(1);
  });

  it("縮小できなかった画像の行は取り込まず、ほかの行は取り込む", async () => {
    const list = people(3);
    const { repo, calls } = fakeRepo();
    const preview = await previewRosterImport(
      { table: csvFile(csvOf(list)), media: list.map((p) => imageFile(`${p.id}.png`, `image-${p.id}`)), ...modeOf },
      deps(repo, { encode: async (f) => { if (f instanceof File && f.name === "m1.png") throw new Error("bad image"); return encode(f); } })
    );
    if (!preview.ok) throw new Error("preview");
    const stats = await preview.apply();
    expect(stats).toMatchObject({ added: 2, failedRows: 1 });
    expect(calls.replace[0].upserts.map((r) => r.id)).toEqual(["m0", "m2"]);
  });

  it("エラーの行が1つでもあれば計画は ok=false で、確定しようとしても何も書かない", async () => {
    const { repo, calls } = fakeRepo();
    const preview = await previewRosterImport({ table: csvFile("ID,名前,写真\na,,\nb,B,none.png\nc,C,"), media: [], ...modeOf }, deps(repo));
    if (!preview.ok) throw new Error("preview");
    expect(preview.plan.ok).toBe(false);
    expect(preview.plan.counts).toMatchObject({ add: 1, error: 2 });
    await expect(preview.apply()).rejects.toThrow();
    expect(calls.replace).toHaveLength(0);
  });

  it("upsert では削除しない: CSV に無い人には触れない", async () => {
    const { repo, calls } = fakeRepo([{ id: "old", name: "既存" }]);
    const preview = await previewRosterImport({ table: csvFile("ID,名前\nnew,新人"), media: [], ...modeOf }, deps(repo));
    if (!preview.ok) throw new Error("preview");
    await preview.apply();
    expect(calls.replace[0]).toEqual({ upserts: [{ id: "new", name: "新人", photo: undefined }], deleteIds: [] });
  });

  it("置き換え: CSV に無い人を deleteIds で消す。管理者とログイン中の人は消さない。書き込みは1回", async () => {
    const roster: Member[] = [
      { id: "root", name: "管理者", isAdmin: true },
      { id: "me", name: "自分" },
      { id: "old", name: "既存" },
      { id: "keep", name: "残る" },
    ];
    const { repo, calls } = fakeRepo(roster);
    const preview = await previewRosterImport({ table: csvFile("ID,名前\nkeep,残る\nnew,新人"), media: [], mode: "replace" }, deps(repo, { currentUserId: "me" }));
    if (!preview.ok) throw new Error("preview");
    expect(preview.plan.counts).toMatchObject({ add: 1, unchanged: 1, delete: 1 });
    const stats = await preview.apply();
    expect(calls.replace).toEqual([{ upserts: [{ id: "new", name: "新人", photo: undefined }], deleteIds: ["old"] }]);
    expect(stats).toMatchObject({ added: 1, deleted: 1 });
  });

  it("写真の差し替えは update、写真だけを戻した行は変更なし(中身のハッシュで見分ける)", async () => {
    const png = imageFile("a.png", "same-bytes");
    const hash = (await crypto.subtle.digest("SHA-256", await png.arrayBuffer().then((b) => new Uint8Array(b)))) as ArrayBuffer;
    const h = Array.from(new Uint8Array(hash).slice(0, 8), (b) => b.toString(16).padStart(2, "0")).join("");
    const { repo } = fakeRepo([{ id: "a", name: "A", photo: h }, { id: "b", name: "B", photo: h }]);
    const preview = await previewRosterImport(
      { table: csvFile("ID,名前,写真\na,A,a.png\nb,B,"), media: [png], ...modeOf },
      deps(repo)
    );
    if (!preview.ok) throw new Error("preview");
    expect(preview.plan.counts).toMatchObject({ unchanged: 2, update: 0 });
    const other = await previewRosterImport({ table: csvFile("ID,名前,写真\na,A,a.png"), media: [imageFile("a.png", "different")], ...modeOf }, deps(repo));
    if (!other.ok) throw new Error("preview");
    expect(other.plan.counts).toMatchObject({ update: 1 });
    expect(other.media).toEqual({ added: 0, replaced: 1 });
  });

  it("書き出した ZIP をそのまま取り込める。CSV が壊れていれば理由を返す", async () => {
    const zip = buildZip("members.csv", "ID,名前,写真\r\nz1,零,z1.png\r\n", new Map([["z1.png", new TextEncoder().encode("pic")]]));
    const { repo } = fakeRepo();
    const preview = await previewRosterImport({ table: new File([zip as BlobPart], "members.zip"), media: [], ...modeOf }, deps(repo));
    expect(preview).toMatchObject({ ok: true });
    if (preview.ok) expect(preview.plan.counts.add).toBe(1);
    expect(await previewRosterImport({ table: csvFile("名前だけ\nx"), media: [], ...modeOf }, deps(repo))).toMatchObject({ ok: false });
    expect(await previewRosterImport({ table: new File(["not zip"], "x.zip"), media: [], ...modeOf }, deps(repo))).toMatchObject({ ok: false });
  });
});
