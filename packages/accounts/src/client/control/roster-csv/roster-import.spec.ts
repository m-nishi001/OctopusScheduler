import { describe, expect, it, vi } from "vitest";
import { RateLimitedError } from "@octopus/infrastructures/interfaces";
import type { Member } from "../../../server/accounts-api-contract";
import { buildRosterZip } from "./roster-archive";
import { previewRosterImport } from "./roster-import";
import type { RosterImportDeps } from "./roster-import";

const csvFile = (text: string, name = "members.csv") => new File([text], name, { type: "text/csv" });
const imageFile = (name: string, content: string) => new File([content], name, { type: "image/png" });
/** 中身から決まる縮小結果(中身が同じなら同じハッシュになる)。 */
const encode = async (file: Blob) => ({ bytes: new Uint8Array(await file.arrayBuffer()), mime: "image/webp" });

function fakeRepo(initial: Member[] = []) {
  const stored = new Set<string>();
  const calls = { put: 0, exists: 0, replace: [] as unknown[][] };
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
    replaceAllMembers: async (members: unknown[]) => {
      calls.replace.push(members);
      return { replaced: members.length };
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
      { table: csvFile(csvOf(list)), images: list.map((p) => imageFile(`${p.id}.png`, `image-${p.id}`)) },
      deps(repo)
    );
    if (!preview.ok) throw new Error(preview.errors.join());
    expect(preview.plan.counts).toMatchObject({ add: 40, error: 0 });
    expect(calls.put + calls.replace.length).toBe(0);

    const stats = await preview.apply();
    expect(calls.exists).toBe(1);
    expect(calls.put).toBe(40);
    expect(calls.replace).toHaveLength(1);
    expect(calls.replace[0]).toHaveLength(40);
    expect(maxInFlight()).toBe(6);
    expect(stats).toMatchObject({ added: 40, updated: 0, uploaded: 40, alreadyOnServer: 0, failedRows: 0, rateLimited: 0, maxConcurrentUploads: 6 });
  });

  it("名簿に書くのは全部の写真を送り終えてから。送信が失敗したら名簿は書かず、やり直せば続きから進む", async () => {
    const list = people(8);
    const { repo, calls, stored } = fakeRepo();
    const input = { table: csvFile(csvOf(list)), images: list.map((p) => imageFile(`${p.id}.png`, `image-${p.id}`)) };
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
      { table: csvFile(csvOf(list)), images: list.map((p) => imageFile(`${p.id}.png`, `image-${p.id}`)) },
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
      { table: csvFile(csvOf(list)), images: list.map((p) => imageFile(`${p.id}.png`, `image-${p.id}`)) },
      deps(repo, { encode: async (f) => { if (f instanceof File && f.name === "m1.png") throw new Error("bad image"); return encode(f); } })
    );
    if (!preview.ok) throw new Error("preview");
    const stats = await preview.apply();
    expect(stats).toMatchObject({ added: 2, failedRows: 1 });
    expect((calls.replace[0] as { id: string }[]).map((r) => r.id)).toEqual(["m0", "m2"]);
  });

  it("エラーの行は取り込まない。取り込める行が無ければ名簿を書かない", async () => {
    const { repo, calls } = fakeRepo();
    const preview = await previewRosterImport({ table: csvFile("ID,名前,写真\na,,\nb,B,none.png"), images: [] }, deps(repo));
    if (!preview.ok) throw new Error("preview");
    expect(preview.plan.counts.error).toBe(2);
    const stats = await preview.apply();
    expect(stats).toMatchObject({ added: 0, errors: 2, uploaded: 0 });
    expect(calls.replace).toHaveLength(0);
  });

  it("削除はしない: CSV に無い人には触れない(名簿へ送るのは CSV の行だけ)", async () => {
    const { repo, calls } = fakeRepo([{ id: "old", name: "既存" }]);
    const preview = await previewRosterImport({ table: csvFile("ID,名前\nnew,新人"), images: [] }, deps(repo));
    if (!preview.ok) throw new Error("preview");
    await preview.apply();
    expect(calls.replace[0]).toEqual([{ id: "new", name: "新人", photo: undefined }]);
  });

  it("書き出した ZIP をそのまま取り込める。CSV が壊れていれば理由を返す", async () => {
    const zip = buildRosterZip("ID,名前,写真\r\nz1,零,z1.png\r\n", new Map([["z1.png", new TextEncoder().encode("pic")]]));
    const { repo } = fakeRepo();
    const preview = await previewRosterImport({ table: new File([zip as BlobPart], "members.zip"), images: [] }, deps(repo));
    expect(preview).toMatchObject({ ok: true });
    if (preview.ok) expect(preview.plan.counts.add).toBe(1);
    expect(await previewRosterImport({ table: csvFile("名前だけ\nx"), images: [] }, deps(repo))).toMatchObject({ ok: false });
    expect(await previewRosterImport({ table: new File(["not zip"], "x.zip"), images: [] }, deps(repo))).toMatchObject({ ok: false });
  });
});
