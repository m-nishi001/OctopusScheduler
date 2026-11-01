/**
 * 名簿の書き出し。CSV だけなら名簿をそのまま、写真つきなら写真を(キャッシュ越しに、まとめて並列に)集めて ZIP にする。
 * 書き出したものは {@link ./roster-import} でそのまま取り込める。
 */
import { buildZip, exportTable } from "@octopus/table-io";
import type { Member } from "../../../server/accounts-api-contract";
import type { MemberPhotoCache } from "../photo/member-photo-cache";
import { photoFileName, ROSTER_CSV_NAME, rosterAdapter, toRosterMembers } from "./roster-table";

export interface RosterExport {
  filename: string;
  mime: string;
  bytes: Uint8Array;
  /** 写真つきで頼まれたが、取得できず含められなかった人数。 */
  missingPhotos: number;
}

/** `data:<mime>;base64,<本体>` をバイト列にする。 */
export function dataUrlToBytes(dataUrl: string): { mime: string; bytes: Uint8Array } {
  const match = /^data:([^;,]+);base64,(.*)$/s.exec(dataUrl);
  if (!match) throw new Error("写真の形式が正しくありません");
  const binary = atob(match[2]);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return { mime: match[1], bytes };
}

/** 名簿を書き出す。`includeMedia` が偽なら CSV のみ(写真の列は空)。 */
export async function exportRoster(
  members: readonly Member[],
  options: { includeMedia: boolean },
  photoCache: Pick<MemberPhotoCache, "ensure" | "get">
): Promise<RosterExport> {
  const adapter = rosterAdapter();
  if (!options.includeMedia) {
    return { filename: ROSTER_CSV_NAME, mime: "text/csv;charset=utf-8", bytes: new TextEncoder().encode(exportTable(toRosterMembers(members), adapter)), missingPhotos: 0 };
  }
  await photoCache.ensure(members.map((m) => m.photo));
  const files = new Map<string, Uint8Array>();
  const names = new Map<string, string>();
  let missingPhotos = 0;
  for (const m of members) {
    if (!m.photo) continue;
    const url = photoCache.get(m.photo);
    if (!url) {
      missingPhotos++;
      continue;
    }
    const { mime, bytes } = dataUrlToBytes(url);
    const name = photoFileName(m.id, mime);
    files.set(name, bytes);
    names.set(m.id, name);
  }
  return {
    filename: "members.zip",
    mime: "application/zip",
    bytes: buildZip(ROSTER_CSV_NAME, exportTable(toRosterMembers(members, names), adapter), files),
    missingPhotos,
  };
}
