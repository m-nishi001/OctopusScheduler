/**
 * 名簿(メンバー一覧)のドメインモデル。純粋関数だけで、保存・排他・写真ファイルの削除は持たない
 * (それは use case の仕事)。名簿の組み直しはすべてここを通すので、`photo` のような項目が
 * 組み直しの途中で落ちることが構造的に起きない。
 *
 * 写真の持ち主は名簿だけ。写真の差し替えやメンバーの削除で、どのメンバーからも参照されなくなった
 * 写真は「孤児」として返す(消すのは use case)。
 */
import type { Member } from "./accounts-api-contract";

/** 名簿への変更の結果。`next` が新しい名簿、`orphanPhotos` が誰からも参照されなくなった写真のハッシュ。 */
export interface RosterChange {
  next: Member[];
  orphanPhotos: string[];
}

/** 追加・更新・一括反映で受け取るメンバーの入力。`isAdmin` / `photo` の省略は「いまの値を保つ」。 */
export interface MemberInput {
  id?: string;
  name: string;
  isAdmin?: boolean;
  /** 写真のハッシュ。省略で保つ。空文字で外す。 */
  photo?: string;
}

const PHOTO_HASH_PATTERN = /^[0-9a-f]{16}$/;

/** 写真のハッシュとして正しい形(SHA-256 の先頭16桁・16進の小文字)か。保存先のキーに使うので厳密に見る。 */
export function isPhotoHash(value: string): boolean {
  return PHOTO_HASH_PATTERN.test(value);
}

/** 保存する形に整える。値のある項目だけを持たせる(未設定の `isAdmin` / `photo` は持たない)。 */
function toStored(m: { id: string; name: string; isAdmin?: boolean; photo?: string }): Member {
  const stored: Member = { id: m.id, name: m.name };
  if (m.isAdmin) stored.isAdmin = true;
  if (m.photo) stored.photo = m.photo;
  return stored;
}

/** 入力の写真を、いまの写真と合わせて決める。省略=保つ、空文字=外す、値=差し替え。 */
function resolvePhoto(input: string | undefined, current: string | undefined): string | undefined {
  if (input === undefined) return current;
  if (input === "") return undefined;
  if (!isPhotoHash(input)) throw new Error(`Invalid photo hash: "${input}"`);
  return input;
}

/** `before` にあって `after` に無い写真(重複は1つにまとめる)。 */
function orphansBetween(before: Member[], after: Member[]): string[] {
  const kept = new Set(after.map((m) => m.photo).filter((p): p is string => !!p));
  const orphans = new Set<string>();
  for (const m of before) if (m.photo && !kept.has(m.photo)) orphans.add(m.photo);
  return [...orphans];
}

function change(before: Member[], next: Member[]): RosterChange {
  return { next, orphanPhotos: orphansBetween(before, next) };
}

/** メンバーを追加する。名前は必須。id を省略すると `newId()` で付ける。同じ id が既にあればエラー。 */
export function addMemberToRoster(
  roster: Member[],
  input: MemberInput,
  newId: () => string
): RosterChange & { member: Member } {
  const name = input.name.trim();
  if (!name) throw new Error("name is required");
  const id = input.id?.trim() || newId();
  if (roster.some((m) => m.id === id)) throw new Error(`Member with id "${id}" already exists`);
  const member = toStored({ id, name, isAdmin: input.isAdmin, photo: resolvePhoto(input.photo, undefined) });
  return { ...change(roster, [...roster, member]), member };
}

/** メンバーを更新する。いなければエラー。`isAdmin` / `photo` の省略は、いまの値を保つ。 */
export function updateMemberInRoster(roster: Member[], input: MemberInput & { id: string }): RosterChange & { member: Member } {
  const index = roster.findIndex((m) => m.id === input.id);
  if (index === -1) throw new Error(`Member with id "${input.id}" not found`);
  const current = roster[index];
  const member = toStored({
    id: current.id,
    name: input.name,
    isAdmin: input.isAdmin ?? current.isAdmin,
    photo: resolvePhoto(input.photo, current.photo),
  });
  const next = [...roster];
  next[index] = member;
  return { ...change(roster, next), member };
}

/** メンバーを外す。いなくても何も起きない。 */
export function deleteMemberFromRoster(roster: Member[], id: string): RosterChange {
  return change(
    roster,
    roster.filter((m) => m.id !== id)
  );
}

/**
 * id をキーに追加または更新する(一括反映・CSV 取込用)。入力に含まれない既存メンバーは消さない
 * (名簿は他モジュールとも共有されているので、一括置換で消してはいけない)。
 * 管理者権限は付与も剥奪もしない(既存値を保つ。新規は管理者にならない)。
 * 同じ id が入力に複数あれば、後のものが勝つ。
 */
export function upsertMembers(roster: Member[], rows: MemberInput[], newId: () => string): RosterChange {
  const byId = new Map(roster.map((m) => [m.id, m] as const));
  for (const row of rows) {
    const id = row.id?.trim() || newId();
    const current = byId.get(id);
    byId.set(
      id,
      toStored({ id, name: row.name, isAdmin: current?.isAdmin, photo: resolvePhoto(row.photo, current?.photo) })
    );
  }
  return change(roster, Array.from(byId.values()));
}

/** 指定の id を管理者にする。いなければ `fallbackName` で作る(初回管理者の用意)。名簿のほかの項目は変えない。 */
export function ensureAdminInRoster(roster: Member[], id: string, fallbackName: string): Member[] {
  if (!roster.some((m) => m.id === id)) return [...roster, { id, name: fallbackName, isAdmin: true }];
  return roster.map((m) => (m.id === id ? { ...m, isAdmin: true } : m));
}

/** 誰でも見られる名簿の姿(管理者フラグ等は含めない。写真のハッシュは秘密ではないので含める)。 */
export function toPublicMember(m: Member): Member {
  const view: Member = { id: m.id, name: m.name };
  if (m.photo) view.photo = m.photo;
  return view;
}
