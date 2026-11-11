import { describe, expect, it } from "vitest";
import type { Member } from "../accounts-api-contract";
import {
  addMemberToRoster,
  applyRosterChange,
  deleteMemberFromRoster,
  ensureAdminInRoster,
  isPhotoHash,
  toPublicMember,
  updateMemberInRoster,
  upsertMembers,
} from "../roster-domain";

const A = "aaaaaaaaaaaaaaaa";
const B = "bbbbbbbbbbbbbbbb";
const newId = (() => {
  let n = 0;
  return () => `gen-${++n}`;
})();

const roster = (): Member[] => [
  { id: "u1", name: "太郎", photo: A },
  { id: "u2", name: "花子", isAdmin: true },
  { id: "u3", name: "次郎", photo: B },
];

describe("roster-domain: 写真のハッシュ", () => {
  it("16桁の16進(小文字)だけを受け付ける", () => {
    expect(isPhotoHash(A)).toBe(true);
    expect(isPhotoHash("0123456789abcdef")).toBe(true);
    for (const bad of ["", "abc", "AAAAAAAAAAAAAAAA", "aaaaaaaaaaaaaaaaa", "../etc/passwdxx", "aaaaaaaaaaaaaaa_"]) {
      expect(isPhotoHash(bad)).toBe(false);
    }
  });
});

describe("roster-domain: addMemberToRoster", () => {
  it("写真つきで追加でき、名前は trim され、id 省略で採番される", () => {
    const { next, member, orphanPhotos } = addMemberToRoster([], { name: " 太郎 ", photo: A }, () => "gen-x");
    expect(member).toEqual({ id: "gen-x", name: "太郎", photo: A });
    expect(next).toEqual([member]);
    expect(orphanPhotos).toEqual([]);
  });

  it("名前が空・id が重複・写真のハッシュが不正ならエラー", () => {
    expect(() => addMemberToRoster([], { name: " " }, newId)).toThrow("name is required");
    expect(() => addMemberToRoster(roster(), { id: "u1", name: "x" }, newId)).toThrow("already exists");
    expect(() => addMemberToRoster([], { name: "x", photo: "nope" }, newId)).toThrow("Invalid photo hash");
  });
});

describe("roster-domain: updateMemberInRoster", () => {
  it("写真を省略しても、既存の写真と管理者権限は保たれる(組み直しで落ちない)", () => {
    const { member, next, orphanPhotos } = updateMemberInRoster(roster(), { id: "u1", name: "太郎2" });
    expect(member).toEqual({ id: "u1", name: "太郎2", photo: A });
    expect(next[0]).toEqual(member);
    expect(orphanPhotos).toEqual([]);
    expect(updateMemberInRoster(roster(), { id: "u2", name: "花子2" }).member).toEqual({ id: "u2", name: "花子2", isAdmin: true });
  });

  it("写真を差し替えると、古い写真が孤児になる", () => {
    const { member, orphanPhotos } = updateMemberInRoster(roster(), { id: "u1", name: "太郎", photo: "cccccccccccccccc" });
    expect(member.photo).toBe("cccccccccccccccc");
    expect(orphanPhotos).toEqual([A]);
  });

  it("空文字で写真を外すと孤児になる。同じ写真に差し替えても孤児にならない", () => {
    const cleared = updateMemberInRoster(roster(), { id: "u1", name: "太郎", photo: "" });
    expect(cleared.member).toEqual({ id: "u1", name: "太郎" });
    expect(cleared.orphanPhotos).toEqual([A]);
    expect(updateMemberInRoster(roster(), { id: "u1", name: "太郎", photo: A }).orphanPhotos).toEqual([]);
  });

  it("別のメンバーも同じ写真を使っていれば、孤児にならない", () => {
    const shared: Member[] = [
      { id: "u1", name: "太郎", photo: A },
      { id: "u2", name: "花子", photo: A },
    ];
    expect(updateMemberInRoster(shared, { id: "u1", name: "太郎", photo: B }).orphanPhotos).toEqual([]);
  });

  it("いないメンバーはエラー", () => {
    expect(() => updateMemberInRoster(roster(), { id: "zz", name: "x" })).toThrow("not found");
  });
});

describe("roster-domain: deleteMemberFromRoster", () => {
  it("削除すると、そのメンバーだけが使っていた写真が孤児になる", () => {
    const { next, orphanPhotos } = deleteMemberFromRoster(roster(), "u3");
    expect(next.map((m) => m.id)).toEqual(["u1", "u2"]);
    expect(orphanPhotos).toEqual([B]);
  });

  it("写真が無いメンバー・いないメンバーの削除は孤児を出さない", () => {
    expect(deleteMemberFromRoster(roster(), "u2").orphanPhotos).toEqual([]);
    expect(deleteMemberFromRoster(roster(), "zz")).toEqual({ next: roster(), orphanPhotos: [] });
  });
});

describe("roster-domain: upsertMembers", () => {
  it("id が無ければ追加、あれば上書きする。入力に無い既存メンバーは消さない", () => {
    const { next } = upsertMembers(roster(), [{ id: "u1", name: "太郎(改)" }, { id: "u9", name: "新人", photo: B }], newId);
    expect(next.map((m) => m.id)).toEqual(["u1", "u2", "u3", "u9"]);
    expect(next.find((m) => m.id === "u1")).toEqual({ id: "u1", name: "太郎(改)", photo: A });
    expect(next.find((m) => m.id === "u9")).toEqual({ id: "u9", name: "新人", photo: B });
  });

  it("空の入力では何も消えない(削除はしない)", () => {
    expect(upsertMembers(roster(), [], newId)).toEqual({ next: roster(), orphanPhotos: [] });
  });

  it("isAdmin を指定すると付与・剥奪し、省略するといまの値を保つ(新規は管理者にならない)", () => {
    const { next } = upsertMembers(roster(), [{ id: "u1", name: "太郎", isAdmin: true }, { id: "u2", name: "花子", isAdmin: false }, { id: "u3", name: "次郎" }, { id: "n", name: "新人" }], newId);
    expect(next.find((m) => m.id === "u1")?.isAdmin).toBe(true);
    expect(next.find((m) => m.id === "u2")?.isAdmin).toBeUndefined();
    expect(next.find((m) => m.id === "u3")?.isAdmin).toBeUndefined();
    expect(next.find((m) => m.id === "n")?.isAdmin).toBeUndefined();
    expect(upsertMembers(roster(), [{ id: "u2", name: "花子" }], newId).next.find((m) => m.id === "u2")?.isAdmin).toBe(true);
  });


  it("写真の差し替えで孤児を返す。同じ写真を別メンバーへ移しても孤児にならない", () => {
    const replaced = upsertMembers(roster(), [{ id: "u1", name: "太郎", photo: "dddddddddddddddd" }], newId);
    expect(replaced.orphanPhotos).toEqual([A]);
    const moved = upsertMembers(roster(), [{ id: "u1", name: "太郎", photo: B }, { id: "u3", name: "次郎", photo: A }], newId);
    expect(moved.orphanPhotos).toEqual([]);
  });

  it("id が無い行は採番して追加する。同じ id が複数あれば後の行が勝つ", () => {
    const { next } = upsertMembers([], [{ name: "A" }, { id: "x", name: "1" }, { id: "x", name: "2" }], () => "gen-1");
    expect(next).toEqual([{ id: "gen-1", name: "A" }, { id: "x", name: "2" }]);
  });
});

describe("roster-domain: applyRosterChange(管理者の付与・剥奪)", () => {
  const twoAdmins = (): Member[] => [...roster(), { id: "u4", name: "三郎", isAdmin: true }];

  it("管理者にした人と外した人を返す(新規に追加した管理者も付与に入る)", () => {
    const r = applyRosterChange(twoAdmins(), { upserts: [{ id: "u1", name: "太郎", isAdmin: true }, { id: "u4", name: "三郎", isAdmin: false }, { id: "n", name: "新人", isAdmin: true }], deleteIds: [], actorId: "u2" }, newId);
    expect(r.grantedAdminIds.sort()).toEqual(["n", "u1"].sort());
    expect(r.revokedAdminIds).toEqual(["u4"]);
    expect(r.next.filter((m) => m.isAdmin).map((m) => m.id).sort()).toEqual(["n", "u1", "u2"].sort());
  });

  it("isAdmin を省略した行や、すでに同じ値の行は、付与にも剥奪にもならない", () => {
    const r = applyRosterChange(roster(), { upserts: [{ id: "u2", name: "花子(改)" }, { id: "u2", name: "花子(改)", isAdmin: true }, { id: "u1", name: "太郎", isAdmin: false }], deleteIds: [], actorId: "u2" }, newId);
    expect(r.grantedAdminIds).toEqual([]);
    expect(r.revokedAdminIds).toEqual([]);
  });

  it("実行者が自分の管理者権限を外す変更は拒否する(ほかの管理者が残っていても)", () => {
    expect(() => applyRosterChange(twoAdmins(), { upserts: [{ id: "u2", name: "花子", isAdmin: false }], deleteIds: [], actorId: "u2" }, newId)).toThrow("自分の管理者権限は外せません");
  });

  it("反映後に管理者が0人になる変更は拒否する", () => {
    expect(() => applyRosterChange(roster(), { upserts: [{ id: "u2", name: "花子", isAdmin: false }], deleteIds: [], actorId: "someone-else" }, newId)).toThrow("管理者が0人になる");
    expect(() => applyRosterChange(twoAdmins(), { upserts: [{ id: "u2", name: "花子", isAdmin: false }, { id: "u4", name: "三郎", isAdmin: false }], deleteIds: [], actorId: "u1" }, newId)).toThrow("管理者が0人になる");
  });

  it("管理者の削除は拒否する。拒否したとき、名簿は変わらない", () => {
    const before = twoAdmins();
    expect(() => applyRosterChange(before, { upserts: [], deleteIds: ["u4"], actorId: "u2" }, newId)).toThrow("管理者は削除できません");
    expect(before).toEqual(twoAdmins());
  });
});

describe("roster-domain: その他", () => {
  it("ensureAdminInRoster は、写真などを落とさずに管理者にする。いなければ作る", () => {
    const promoted = ensureAdminInRoster(roster(), "u1", "x");
    expect(promoted[0]).toEqual({ id: "u1", name: "太郎", photo: A, isAdmin: true });
    expect(ensureAdminInRoster([], "admin", "管理者")).toEqual([{ id: "admin", name: "管理者", isAdmin: true }]);
  });

  it("toPublicMember は管理者フラグを含めず、写真のハッシュだけ含める", () => {
    expect(toPublicMember({ id: "u2", name: "花子", isAdmin: true })).toEqual({ id: "u2", name: "花子" });
    expect(toPublicMember({ id: "u1", name: "太郎", photo: A, hasPassword: true })).toEqual({ id: "u1", name: "太郎", photo: A });
  });
});
