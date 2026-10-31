/**
 * 名簿の CSV 取込の段取り。判断は {@link ./roster-csv} の純粋関数に任せ、ここは
 * 「読む → 計画する(プレビュー)→ 画像を並列に縮小 → 並列に送る → 名簿を1回だけ書く」という順序だけを受け持つ。
 *
 * - 名簿を書くのは最後の1回(`replaceAllMembers` = 追加または更新。削除はしない)。途中で失敗しても、
 *   写真の無い・一部だけの名簿が書かれることはない。写真の ID は内容のハッシュなので、やり直せば続きから進む。
 * - 状態は持たない。プレビューの結果が、確定する関数(`apply`)を抱えて返る。
 */
import type { Member } from "../../../server/accounts-api-contract";
import { hashPhotoBytes, preparePhoto } from "../photo/photo-prepare";
import type { EncodedImage, PreparedPhoto } from "../photo/photo-prepare";
import { uploadMemberPhotos } from "../photo/photo-upload";
import type { MemberPhotoUploader } from "../photo/photo-upload";
import { mapPool } from "@octopus/sync-engine/pool/promise-pool";
import type { PoolOptions } from "@octopus/sync-engine/pool/promise-pool";
import { readRosterZip } from "./roster-archive";
import { parseRosterCsv, photoFileKey, planRosterImport, rosterUpserts } from "./roster-csv";
import type { RosterImportPlan, RosterUpsertInput } from "./roster-csv";

/** 取込に必要な名簿の窓口(AccountsRepository がそのまま満たす)。 */
export interface RosterImportRepository extends MemberPhotoUploader {
  listMembers(): Promise<Member[]>;
  replaceAllMembers(members: RosterUpsertInput[]): Promise<{ replaced: number }>;
}

export interface RosterImportDeps {
  repo: RosterImportRepository;
  /** 縮小した写真を端末のキャッシュに入れる(取込後すぐ名簿に顔を出すため)。 */
  photoCache?: { remember(hash: string, dataUrl: string): Promise<void> };
  /** 縮小・変換の実装。テストで差し替える。 */
  encode?: (file: Blob) => Promise<EncodedImage>;
  pool?: PoolOptions;
  now?: () => number;
}

/** 取込に渡す入力: CSV または書き出した ZIP と、画像(フォルダで選んだもの)。 */
export interface RosterImportInput {
  table: File;
  images: readonly File[];
}

/** 取込を確定した結果。 */
export interface RosterImportStats {
  added: number;
  updated: number;
  unchanged: number;
  /** 計画の時点でエラーだった行(取り込んでいない)。 */
  errors: number;
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
  | { ok: true; plan: RosterImportPlan; apply(onProgress?: (message: string) => void): Promise<RosterImportStats> };

/** CSV(または ZIP)と画像を読み、計画を立てる。名簿はまだ書かない。 */
export async function previewRosterImport(input: RosterImportInput, deps: RosterImportDeps): Promise<RosterImportPreview> {
  const images = new Map<string, Blob>();
  let csvBytes: Uint8Array;
  if (/\.zip$/i.test(input.table.name)) {
    let zipped: ReturnType<typeof readRosterZip>;
    try {
      zipped = readRosterZip(new Uint8Array(await input.table.arrayBuffer()));
    } catch {
      return { ok: false, errors: ["ZIP を開けません"] };
    }
    if (!zipped.csv) return { ok: false, errors: ["ZIP の中に CSV が見つかりません"] };
    csvBytes = zipped.csv;
    for (const [name, bytes] of zipped.images) images.set(photoFileKey(name), new Blob([bytes as BlobPart]));
  } else {
    csvBytes = new Uint8Array(await input.table.arrayBuffer());
  }
  // フォルダで選んだ画像は、ZIP の中の同名の画像より優先する。
  for (const file of input.images) images.set(photoFileKey(file.name), file);

  const parsed = parseRosterCsv(csvBytes);
  if (!parsed.ok) return parsed;

  // CSV が指している画像だけ、元ファイルのハッシュを並列に計算する(書き出した写真と同一か見分けるため)。
  const referenced = [...new Set(parsed.rows.map((r) => r.photo && photoFileKey(r.photo)).filter((k): k is string => !!k && images.has(k)))];
  const [current, rawHashes] = await Promise.all([
    deps.repo.listMembers(),
    mapPool(referenced, async (key) => [key, await hashPhotoBytes(new Uint8Array(await images.get(key)!.arrayBuffer()))] as const, deps.pool),
  ]);
  const plan = planRosterImport(current, parsed.rows, new Map(rawHashes));
  return { ok: true, plan, apply: (onProgress) => applyRosterImport(plan, images, deps, onProgress) };
}

async function applyRosterImport(
  plan: RosterImportPlan,
  images: ReadonlyMap<string, Blob>,
  deps: RosterImportDeps,
  onProgress: (message: string) => void = () => undefined
): Promise<RosterImportStats> {
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
  onProgress(`画像を縮小しています(0/${plan.photoKeys.length})`);
  let done = 0;
  const prepared = await mapPool(
    plan.photoKeys,
    async (key): Promise<[string, PreparedPhoto | null]> => {
      try {
        return [key, await preparePhoto(images.get(key)!, deps.encode)];
      } catch {
        return [key, null];
      } finally {
        onProgress(`画像を縮小しています(${++done}/${plan.photoKeys.length})`);
      }
    },
    pool
  );
  const preparedAt = now();
  const photos = prepared.filter((p): p is [string, PreparedPhoto] => p[1] !== null);

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

  // 3. 名簿を1回だけ書く(追加または更新。削除はしない)。
  const { upserts, skipped } = rosterUpserts(plan, new Map(photos.map(([key, p]) => [key, p.hash] as const)));
  onProgress("名簿を更新しています");
  if (upserts.length > 0) await deps.repo.replaceAllMembers(upserts);
  const finished = now();

  const upserted = (status: "add" | "update") => plan.rows.filter((r) => r.status === status).length - skipped.filter((r) => r.status === status).length;
  return {
    added: upserted("add"),
    updated: upserted("update"),
    unchanged: plan.counts.unchanged,
    errors: plan.counts.error,
    failedRows: skipped.length,
    uploaded: upload.uploaded,
    alreadyOnServer: upload.skipped,
    prepareMs: preparedAt - started,
    uploadMs: uploadedAt - preparedAt,
    totalMs: finished - started,
    maxConcurrentUploads,
    rateLimited,
  };
}
