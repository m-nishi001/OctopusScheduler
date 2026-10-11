import { container } from "tsyringe";
import { AssetDataService } from "../asset/asset-data-service";
import { MemberService } from "./member-service";

export interface MemberPhotoSource {
  /** ジャックポットのメンバー一覧（顔写真のアセットIDを持つ）。 */
  listMembers(): Promise<Array<{ id: string; photoAssetId?: string }>>;
  /** アセットの中身。無ければ null。 */
  getAsset(assetId: string): Promise<{ blob?: Blob } | null>;
  createUrl(blob: Blob): string;
  revokeUrl(url: string): void;
}

/**
 * メンバーの顔写真を、ホスト端末が持つジャックポットのデータ（メンバー + 写真アセット）から引く。
 * 参加者のスマホには写真を渡さず、会場の画面（ホスト）でだけ表示するために使う。
 * 写真が無い・読めないメンバーは undefined を返す（呼び出し側が既定のアバターを出す）。
 */
export class MemberPhotoCache {
  private readonly urls = new Map<string, string | null>();
  /** 読み込み中のメンバー。同時に呼ばれても同じ写真を二重に読み込まない。 */
  private readonly loading = new Map<string, Promise<void>>();
  private assetIdByMember: Map<string, string | undefined> | null = null;

  constructor(private readonly source: MemberPhotoSource) {}

  /** 写真を表示するURL。まだ読み込んでいない・写真が無いときは undefined。 */
  get(memberId: string): string | undefined {
    return this.urls.get(memberId) ?? undefined;
  }

  /** 指定したメンバーの写真を読み込む（読み込み済み・読み込み中は何もしない）。失敗したメンバーは写真無しとして扱う。 */
  async ensure(memberIds: string[]): Promise<void> {
    const missing = memberIds.filter((id) => !this.urls.has(id) && !this.loading.has(id));
    if (missing.length > 0) {
      const batch = this.load(missing);
      for (const id of missing) this.loading.set(id, batch);
      await batch;
      for (const id of missing) this.loading.delete(id);
    }
    // 他の呼び出しが読み込み中のものも、終わるまで待つ
    await Promise.all(memberIds.map((id) => this.loading.get(id)).filter((p): p is Promise<void> => p !== undefined));
  }

  private async load(missing: string[]): Promise<void> {
    let index: Map<string, string | undefined>;
    try {
      index = await this.memberIndex(missing);
    } catch {
      return; // メンバー一覧が読めなければ、次の機会に再試行する
    }
    await Promise.all(
      missing.map(async (memberId) => {
        const assetId = index.get(memberId);
        if (!assetId) {
          this.urls.set(memberId, null);
          return;
        }
        try {
          const asset = await this.source.getAsset(assetId);
          this.urls.set(memberId, asset?.blob ? this.source.createUrl(asset.blob) : null);
        } catch {
          this.urls.set(memberId, null);
        }
      })
    );
  }

  /** メンバー一覧は1回読み込んで使い回す。知らないメンバーが来たら（名簿が増えた可能性があるので）読み直す。 */
  private async memberIndex(wanted: string[]): Promise<Map<string, string | undefined>> {
    if (!this.assetIdByMember || wanted.some((id) => !this.assetIdByMember!.has(id))) {
      const members = await this.source.listMembers();
      this.assetIdByMember = new Map(members.map((m) => [m.id, m.photoAssetId]));
    }
    return this.assetIdByMember;
  }

  /** 作ったURLを解放する。画面を閉じるときに呼ぶ。 */
  dispose(): void {
    for (const url of this.urls.values()) if (url) this.source.revokeUrl(url);
    this.urls.clear();
    this.assetIdByMember = null;
  }
}

/** アプリのDI（メンバー・アセットのサービス）につないだ写真キャッシュ。 */
export function createMemberPhotoCache(): MemberPhotoCache {
  return new MemberPhotoCache({
    listMembers: () => container.resolve(MemberService).fetchMembers(),
    getAsset: (id) => container.resolve(AssetDataService).getAssetDataById(id),
    createUrl: (blob) => URL.createObjectURL(blob),
    revokeUrl: (url) => URL.revokeObjectURL(url),
  });
}
