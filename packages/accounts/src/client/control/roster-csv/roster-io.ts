/**
 * 名簿の一括書き出し・取込を、画面の部品(ui-kit の `TableIoToolbar` / `TableImportDialog`)につなぐ。
 * 設定>メンバーとクイズ>メンバー管理が同じものを使う。画面ライブラリには依存せず、部品が求める形を返すだけ。
 */
import type { ImportMode } from "@octopus/table-io";
import type { Member } from "../../../server/accounts-api-contract";
import type { MemberPhotoCache } from "../photo/member-photo-cache";
import { exportRoster } from "./roster-export";
import { previewRosterImport } from "./roster-import";
import type { RosterImportRepository } from "./roster-import";

export interface RosterTableIoDeps {
  /** 名簿の窓口(`AccountsRepository`)。 */
  repo: RosterImportRepository & { listAccounts(): Promise<Member[]> };
  photos: Pick<MemberPhotoCache, "ensure" | "get" | "remember">;
  /** ログイン中のメンバー(置き換えでも削除しない)。 */
  currentUserId?: () => string | undefined;
  /** 取込を確定したあとに呼ぶ(一覧の読み直しなど)。 */
  afterImport?: () => Promise<unknown>;
  /** 書き出しの注意(写真を含められなかったなど)。 */
  warn?: (message: string) => void;
  /** 書き出したファイルを渡す。既定はブラウザのダウンロード。 */
  save?: (file: { filename: string; mime: string; bytes: Uint8Array }) => void;
}

function browserDownload({ filename, mime, bytes }: { filename: string; mime: string; bytes: Uint8Array }): void {
  const url = URL.createObjectURL(new Blob([bytes as BlobPart], { type: mime }));
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

const seconds = (ms: number) => `${(ms / 1000).toFixed(1)}秒`;

/** 設定>メンバーとクイズ>メンバー管理が使う、`onExport`(CSVダウンロード)と `onPreviewImport`(取込のプレビュー)を作る。 */
export function rosterTableIo(deps: RosterTableIoDeps) {
  const { repo, photos } = deps;
  const importRepo: RosterImportRepository = {
    listMembers: () => repo.listAccounts(),
    existsMemberPhotos: (hashes) => repo.existsMemberPhotos(hashes),
    putMemberPhoto: (hash, dataUrl) => repo.putMemberPhoto(hash, dataUrl),
    applyRoster: (args) => repo.applyRoster(args),
  };

  /** いまの名簿を CSV(素材も含めるときは ZIP)にして保存する。取込と同じ書式。 */
  async function onExport(options: { includeMedia: boolean }): Promise<void> {
    const out = await exportRoster(await repo.listAccounts(), options, photos);
    (deps.save ?? browserDownload)(out);
    if (out.missingPhotos > 0) deps.warn?.(`${out.missingPhotos}人の写真を取得できず、含めていません`);
  }

  /** 選んだ CSV・画像を読んでプレビューを作る。確定すると、写真を並列に送ってから名簿を1回だけ書く。 */
  async function onPreviewImport(input: { table: File; media: File[]; mode: ImportMode }) {
    const preview = await previewRosterImport(input, { repo: importRepo, photoCache: photos, currentUserId: deps.currentUserId?.() });
    if (!preview.ok) return preview;
    return {
      ok: true as const,
      rows: preview.plan.rows,
      counts: preview.plan.counts,
      media: preview.media,
      apply: async (onProgress: (message: string) => void) => {
        const s = await preview.apply(onProgress);
        await deps.afterImport?.();
        const failed = s.failedRows ? `、画像を処理できず取り込めなかった行 ${s.failedRows}` : "";
        return {
          summary: `追加 ${s.added} / 更新 ${s.updated} / 変更なし ${s.unchanged} / 削除 ${s.deleted}${failed}`,
          details: [
            `写真: 送信 ${s.uploaded}枚 / サーバーに既にあった ${s.alreadyOnServer}枚`,
            `所要時間 ${seconds(s.totalMs)}(縮小 ${seconds(s.prepareMs)} / 送信 ${seconds(s.uploadMs)})`,
            `同時送信の最大数 ${s.maxConcurrentUploads} / 回数制限(429)で待った回数 ${s.rateLimited}`,
          ],
        };
      },
    };
  }

  return { onExport, onPreviewImport };
}
