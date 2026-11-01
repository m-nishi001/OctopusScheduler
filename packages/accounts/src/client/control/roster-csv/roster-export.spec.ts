import { describe, expect, it } from "vitest";
import { unzipSync } from "fflate";
import type { Member } from "../../../server/accounts-api-contract";
import { dataUrlToBytes, exportRoster } from "./roster-export";
import { previewRosterImport } from "./roster-import";

const toUrl = (text: string, mime: string) => `data:${mime};base64,${btoa(text)}`;
const members: Member[] = [
  { id: "a", name: "アリス", photo: "0123456789abcdef" },
  { id: "b", name: "ボブ", photo: "fedcba9876543210" },
  { id: "c", name: "キャロル" },
];
const cache = (urls: Record<string, string>) => ({ ensure: async () => undefined, get: (h?: string) => (h ? urls[h] : undefined) });

describe("exportRoster", () => {
  it("CSV のみ: 写真の列は空", async () => {
    const out = await exportRoster(members, { includeMedia: false }, cache({}));
    expect(out.filename).toBe("members.csv");
    expect(new TextDecoder().decode(out.bytes)).toContain("a,アリス,\r\n");
  });

  it("写真つき: ZIP に members.csv と media/<id>.<拡張子>。取得できない写真は数える", async () => {
    const out = await exportRoster(members, { includeMedia: true }, cache({ "0123456789abcdef": toUrl("PIC", "image/webp") }));
    expect(out).toMatchObject({ filename: "members.zip", missingPhotos: 1 });
    const files = unzipSync(out.bytes);
    expect(Object.keys(files).sort()).toEqual(["media/a.webp", "members.csv"]);
    expect(new TextDecoder().decode(files["media/a.webp"])).toBe("PIC");
    expect(new TextDecoder().decode(files["members.csv"])).toContain("a,アリス,a.webp");
  });

  it("書き出した ZIP を取り込むと、写真の中身が同じなので全行「変更なし」になる", async () => {
    // 名簿の写真のハッシュ = 書き出す画像の中身のハッシュ、という関係を再現する
    const bytes = new TextEncoder().encode("PIC");
    const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", bytes));
    const hash = Array.from(digest.slice(0, 8), (b) => b.toString(16).padStart(2, "0")).join("");
    const roster: Member[] = [{ id: "a", name: "アリス", photo: hash }, { id: "b", name: "ボブ" }];
    const out = await exportRoster(roster, { includeMedia: true }, cache({ [hash]: toUrl("PIC", "image/webp") }));
    const preview = await previewRosterImport(
      { table: new File([out.bytes as BlobPart], out.filename), media: [], mode: "replace" },
      { repo: { listMembers: async () => roster, existsMemberPhotos: async () => [], putMemberPhoto: async () => undefined, applyRoster: async () => ({ upserted: 0, deleted: 0 }) } }
    );
    if (!preview.ok) throw new Error(preview.errors.join());
    expect(preview.plan.counts).toEqual({ add: 0, update: 0, unchanged: 2, delete: 0, error: 0 });
  });
});

describe("dataUrlToBytes", () => {
  it("データURLをバイト列に戻す。形式が違えば例外", () => {
    expect(dataUrlToBytes(toUrl("hi", "image/png"))).toMatchObject({ mime: "image/png", bytes: new TextEncoder().encode("hi") });
    expect(() => dataUrlToBytes("nope")).toThrow();
  });
});
