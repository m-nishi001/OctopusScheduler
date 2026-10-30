/**
 * メンバーの顔写真の保存・確認・取得・削除。写真は「中身のハッシュ」を名前にしたファイルで、
 * 同じ画像なら同じキーへの上書きになる(送り直しても安全で、別のキーとぶつからない)。
 * どの写真を誰が使っているかは名簿(`Member.photo`)だけが知っている。ここは保存先の操作だけを持つ。
 */
import { createDriveAssets, StorageKind, StorageModule, storageNamespace } from "@octopus/infrastructures/compositions";
import type { IKeyValueStorage } from "@octopus/infrastructures/interfaces";
import { isPhotoHash } from "./roster-domain";

const assets = createDriveAssets(StorageModule.Accounts, StorageKind.Assets);

/** 1枚の上限(縮小後は100KB程度なので十分余裕がある)。 */
export const MAX_PHOTO_BYTES = 500 * 1024;
/** `getMemberPhotos` で一度に取れる枚数(返事の大きさを抑える)。 */
export const MAX_PHOTOS_PER_READ = 10;
/** `existsMemberPhotos` で一度に確かめられる件数。 */
export const MAX_PHOTOS_PER_EXISTS = 500;

const ALLOWED_TYPES: Record<string, string> = { "image/webp": "webp", "image/jpeg": "jpg", "image/png": "png" };
const DATA_URL_PATTERN = /^data:(image\/[a-z]+);base64,([A-Za-z0-9+/]+={0,2})$/;
const PHOTO_FILE_NAME = "photo";

export interface MemberPhotoDeps {
  storage: IKeyValueStorage;
}

function assertHashes(hashes: string[], max: number): void {
  if (!Array.isArray(hashes)) throw new Error("hashes is required");
  if (hashes.length > max) throw new Error(`Too many photos requested (max ${max})`);
  for (const h of hashes) if (typeof h !== "string" || !isPhotoHash(h)) throw new Error(`Invalid photo hash: "${String(h)}"`);
}

/** base64 をデコードしたあとのバイト数。 */
function decodedBytes(base64: string): number {
  const padding = base64.endsWith("==") ? 2 : base64.endsWith("=") ? 1 : 0;
  return (base64.length / 4) * 3 - padding;
}

/** 写真を保存する。サイズと画像の種類を確かめる(ハッシュは保存先のキーになるだけで、中身との一致は見ない: 書けるのは管理者のみ)。 */
export async function putMemberPhoto(deps: MemberPhotoDeps, args: { hash: string; dataUrl: string }): Promise<{ hash: string }> {
  assertHashes([args.hash], 1);
  const match = typeof args.dataUrl === "string" ? DATA_URL_PATTERN.exec(args.dataUrl) : null;
  if (!match || !ALLOWED_TYPES[match[1]]) throw new Error("Photo must be a WebP, JPEG or PNG data URL");
  if (decodedBytes(match[2]) > MAX_PHOTO_BYTES) throw new Error(`Photo is too large (max ${MAX_PHOTO_BYTES} bytes)`);
  const mime = match[1];
  await assets.save(deps, {
    metadata: { driveDataId: args.hash, fileId: "", parentFolderId: "", lastUpdate: "" },
    fileName: `${PHOTO_FILE_NAME}.${ALLOWED_TYPES[mime]}`,
    fileKind: mime,
    fileDataUrl: args.dataUrl,
    uploadDate: "",
    parentFolderId: "",
  });
  return { hash: args.hash };
}

/** 渡したハッシュのうち、すでに保存されているもの。保存先の一覧を1回だけ引く。 */
export async function existsMemberPhotos(deps: MemberPhotoDeps, hashes: string[]): Promise<{ existing: string[] }> {
  assertHashes(hashes, MAX_PHOTOS_PER_EXISTS);
  const stored = new Set((await assets.listMetadata(deps)).map((m) => m.driveDataId));
  return { existing: [...new Set(hashes)].filter((h) => stored.has(h)) };
}

/** 写真の中身(データURL)をまとめて取る。保存されていないハッシュは結果に含めない。 */
export async function getMemberPhotos(deps: MemberPhotoDeps, hashes: string[]): Promise<{ photos: Record<string, string> }> {
  assertHashes(hashes, MAX_PHOTOS_PER_READ);
  const photos: Record<string, string> = {};
  await Promise.all(
    [...new Set(hashes)].map(async (hash) => {
      const ref = await findPhotoKey(deps, hash);
      const data = ref ? await assets.get(deps, ref) : null;
      if (data) photos[hash] = data.fileDataUrl;
    })
  );
  return { photos };
}

/** 写真を削除する(無いものは何もしない)。名簿から参照されなくなった写真を片づけるために使う。 */
export async function deleteMemberPhotos(deps: MemberPhotoDeps, hashes: string[]): Promise<void> {
  await Promise.all(
    hashes.map(async (hash) => {
      const ref = await findPhotoKey(deps, hash);
      if (ref) await deps.storage.delete(ref);
    })
  );
}

const NAMESPACE = storageNamespace(StorageModule.Accounts, StorageKind.Assets);

/** ハッシュに対応する保存先のキー。無ければ null。 */
async function findPhotoKey(deps: MemberPhotoDeps, hash: string): Promise<string | null> {
  const items = await deps.storage.listByPrefix(`${NAMESPACE}/${hash}_`);
  return items[0]?.key ?? null;
}
