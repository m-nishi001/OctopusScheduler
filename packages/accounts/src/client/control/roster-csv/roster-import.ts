/**
 * 名簿の CSV 取込の段取り。判断は `@octopus/table-io` の `planImport` と {@link ./roster-table} に任せ、ここは
 * 「読む → 計画する(プレビュー)→ 画像を並列に縮小 → 並列に送る → 名簿を1回だけ書く」という順序だけを受け持つ。
 *
 * - 名簿を書くのは最後の1回(`applyRoster` = 追加・更新と、置き換えのときの削除)。途中で失敗しても、
 *   写真の無い・一部だけの名簿が書かれることはない。写真の ID は内容のハッシュなので、やり直せば続きから進む。
 * - 状態は持たない。プレビューの結果が、確定する関数(`apply`)を抱えて返る。
 */
import { parseTable, planImport, readZip } from "@octopus/table-io";
import type { ImportMode, ImportPlan } from "@octopus/table-io";
import { mapPool } from "@octopus/sync-engine/pool/promise-pool";
import type { PoolOptions } from "@octopus/sync-engine/pool/promise-pool";
import type { ApplyRosterArgs, ApplyRosterResult, Member } from "../../../server/accounts-api-contract";
import { hashPhotoBytes, preparePhoto } from "../photo/photo-prepare";
import type { EncodedImage, PreparedPhoto } from "../photo/photo-prepare";
import { uploadMemberPhotos } from "../photo/photo-upload";
import type { MemberPhotoUploader } from "../photo/photo-upload";
import { photoFileKey, ROSTER_HEADERS, rosterAdapter, toRosterMembers } from "./roster-table";
import type { RosterMember } from "./roster-table";

/** 取込に必要な名簿の窓口(AccountsRepository がそのまま満たす)。管理者を守るには `isAdmin` を含む一覧(`listAccounts`)を返すこと。 */
export interface RosterImportRepository extends MemberPhotoUploader {
  listMembers(): Promise<Member[]>;
  applyRoster(args: ApplyRosterArgs): Promise<ApplyRosterResult>;
}

export interface RosterImportDeps {
  repo: RosterImportRepository;
  /** ログイン中のメンバー(置き換えでも削除しない)。 */
  currentUserId?: string;
  /** 縮小した写真を端末のキャッシュに入れる(取込後すぐ名簿に顔を出すため)。 */
  photoCache?: { remember(hash: string, dataUrl: string): Promise<void> };
  /** 縮小・変換の実装。テストで差し替える。 */
  encode?: (file: Blob) => Promise<EncodedImage>;
  pool?: PoolOptions;
  now?: () => number;
}

/** 取込に渡す入力: CSV または書き出した ZIP と、画像(フォルダで選んだもの)、取込のモード。 */
export interface RosterImportInput {
  table: File;
  media: readonly File[];
  mode: ImportMode;
}

/** 取込を確定した結果。 */
export interface RosterImportStats {
  added: number;
  updated: number;
  unchanged: number;
  deleted: number;
  /** 画像を縮小できず取り込まなかった行。 */
  failedRows: number;
  /** サーバーへ送った写真の枚数 / すでにあって送らなかった枚数。 */
  uploaded: number;
  alreadyOnServer: number;
  prepareMs: number;
  uploadMs: number;
  totalMs: number;
  /** 写真の送信が同時に走った最大数(並列に送っていた証拠)。 */
  maxConcurrentUploads: number;
  /** サーバーが回数の上限(429)で断って、待ってやり直した回数。 */
  rateLimited: number;
}

export type RosterImportPreview =
  | { ok: false; errors: string[] }
  | {
      ok: true;
      plan: ImportPlan<RosterMember>;
      /** 取り込む画像の件数(新しい / すでにある名前の差し替え)。 */
      media: { added: number; replaced: number };
      apply(onProgress?: (message: string) => void): Promise<RosterImportStats>;
    };

/** CSV(または ZIP)と画像を読み、計画を立てる。名簿はまだ書かない。 */
export async function previewRosterImport(input: RosterImportInput, deps: RosterImportDeps): Promise<RosterImportPreview> {
  const images = new Map<string, Blob>();
  let csvBytes: Uint8Array;
  if (/\.zip$/i.test(input.table.name)) {
    let zipped: ReturnType<typeof readZip>;
    try {
      zipped = readZip(new Uint8Array(await input.table.arrayBuffer()));
    } catch {
      return { ok: false, errors: ["ZIP を開けません"] };
    }
    if (!zipped.csv) return { ok: false, errors: ["ZIP の中に CSV が見つかりません"] };
    csvBytes = zipped.csv;
    for (const [name, bytes] of zipped.media) images.set(photoFileKey(name), new Blob([bytes as BlobPart]));
  } else {
    csvBytes = new Uint8Array(await input.table.arrayBuffer());
  }
  // フォルダで選んだ画像は、ZIP の中の同名の画像より優先する。
  for (const file of input.media) images.set(photoFileKey(file.name), file);

  const parsed = parseTable(csvBytes, ROSTER_HEADERS);
  if (!parsed.ok) return parsed;

  // CSV が指している画像だけ、元ファイルのハッシュを並列に計算する(書き出した写真と同一か見分けるため)。
  const referenced = [...new Set(parsed.rows.map((r) => r.cells.photo && photoFileKey(r.cells.photo)).filter((k): k is string => !!k && images.has(k)))];
  const [members, rawHashes] = await Promise.all([
    deps.repo.listMembers(),
    mapPool(referenced, async (key) => [key, await hashPhotoBytes(new Uint8Array(await images.get(key)!.arrayBuffer()))] as const, deps.pool),
  ]);
  const hashOf = new Map(rawHashes);

  // 既存の人の写真が、CSV の指す画像と同一(書き出した写真をそのまま戻した)なら、その行の写真は変わらない。
  const byId = new Map(members.map((m) => [m.id, m] as const));
  const sameFile = new Map<string, string>();
  const changedFiles = new Set<string>();
  for (const { cells } of parsed.rows) {
    if (!cells.photo) continue;
    const key = photoFileKey(cells.photo);
    if (!images.has(key)) continue;
    const existing = byId.get(cells.id);
    if (existing?.photo && hashOf.get(key) === existing.photo) sameFile.set(existing.id, key);
    else changedFiles.add(key);
  }

  const current = toRosterMembers(members, sameFile);
  const plan = planImport(current, parsed.rows, rosterAdapter({ files: new Set(images.keys()), currentUserId: deps.currentUserId }), input.mode, changedFiles);

  const seenFiles = new Set<string>();
  const media = { added: 0, replaced: 0 };
  for (const e of plan.upserts) {
    if (!e.photoFile || !changedFiles.has(e.photoFile) || seenFiles.has(e.photoFile)) continue;
    seenFiles.add(e.photoFile);
    if (byId.get(e.id)?.photo) media.replaced++;
    else media.added++;
  }
  return { ok: true, plan, media, apply: (onProgress) => applyRosterImport(plan, { changedFiles, existingIds: new Set(byId.keys()) }, images, deps, onProgress) };
}

async function applyRosterImport(
  plan: ImportPlan<RosterMember>,
  { changedFiles, existingIds }: { changedFiles: ReadonlySet<string>; existingIds: ReadonlySet<string> },
  images: ReadonlyMap<string, Blob>,
  deps: RosterImportDeps,
  onProgress: (message: string) => void = () => undefined
): Promise<RosterImportStats> {
  if (!plan.ok) throw new Error("エラーの行があるため取り込めません");
  const now = deps.now ?? Date.now;
  const started = now();
  let rateLimited = 0;
  const pool: PoolOptions = {
    ...deps.pool,
    onRateLimited: (waitMs) => {
      rateLimited++;
      deps.pool?.onRateLimited?.(waitMs);
    },
  };

  // 1. 画像の縮小とハッシュ計算(並列)。縮小できなかった画像の行は取り込まず、結果で知らせる。
  const keys = [...new Set(plan.upserts.map((e) => e.photoFile).filter((k): k is string => !!k && changedFiles.has(k)))];
  onProgress(`画像を縮小しています(0/${keys.length})`);
  let done = 0;
  const prepared = await mapPool(
    keys,
    async (key): Promise<[string, PreparedPhoto | null]> => {
      try {
        return [key, await preparePhoto(images.get(key)!, deps.encode)];
      } catch {
        return [key, null];
      } finally {
        onProgress(`画像を縮小しています(${++done}/${keys.length})`);
      }
    },
    pool
  );
  const preparedAt = now();
  const photos = prepared.filter((p): p is [string, PreparedPhoto] => p[1] !== null);
  const hashOfFile = new Map(photos.map(([key, p]) => [key, p.hash] as const));

  // 2. サーバーに無い写真だけを並列に送る(同時に走った最大数も数える)。
  let inFlight = 0;
  let maxConcurrentUploads = 0;
  let sent = 0;
  const total = new Set(photos.map(([, p]) => p.hash)).size;
  onProgress(`写真を送っています(0/${total})`);
  const upload = await uploadMemberPhotos(
    {
      existsMemberPhotos: (hashes) => deps.repo.existsMemberPhotos(hashes),
      putMemberPhoto: async (hash, dataUrl) => {
        maxConcurrentUploads = Math.max(maxConcurrentUploads, ++inFlight);
        try {
          await deps.repo.putMemberPhoto(hash, dataUrl);
        } finally {
          inFlight--;
        }
        onProgress(`写真を送っています(${++sent}/${total})`);
      },
    },
    photos.map(([, p]) => p),
    pool
  );
  const uploadedAt = now();
  await Promise.all(photos.map(([, p]) => deps.photoCache?.remember(p.hash, p.dataUrl)));

  // 3. 名簿を1回だけ書く(追加・更新・削除)。画像を用意できなかった行は書かない。
  const failed = plan.upserts.filter((e) => e.photoFile && changedFiles.has(e.photoFile) && !hashOfFile.has(e.photoFile));
  const upserts = plan.upserts
    .filter((e) => !failed.includes(e))
    .map((e) => ({
      id: e.id || undefined,
      name: e.name,
      photo: e.photoFile && changedFiles.has(e.photoFile) ? hashOfFile.get(e.photoFile) : undefined,
    }));
  const deleteIds = plan.deletes.map((e) => e.id);
  onProgress("名簿を更新しています");
  if (upserts.length > 0 || deleteIds.length > 0) await deps.repo.applyRoster({ upserts, deleteIds });
  const finished = now();

  const failedAdds = failed.filter((e) => !existingIds.has(e.id)).length;
  return {
    added: plan.counts.add - failedAdds,
    updated: plan.counts.update - (failed.length - failedAdds),
    unchanged: plan.counts.unchanged,
    deleted: deleteIds.length,
    failedRows: failed.length,
    uploaded: upload.uploaded,
    alreadyOnServer: upload.skipped,
    prepareMs: preparedAt - started,
    uploadMs: uploadedAt - preparedAt,
    totalMs: finished - started,
    maxConcurrentUploads,
    rateLimited,
  };
}
