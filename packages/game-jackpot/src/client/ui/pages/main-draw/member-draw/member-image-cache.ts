import { container } from "tsyringe";
import { AssetDataService } from "@control/asset/asset-data-service";

/** アセットID から、画面に出せる URL(読めなければ null)を得る。 */
export type MemberImageLoader = (assetId: string) => Promise<string | null>;

/** 同時に読むメンバー画像の数。一度に全部読んで端末の読み出しを詰まらせない程度の上限。 */
export const MEMBER_IMAGE_CONCURRENCY = 4;

/**
 * メンバーの写真の URL の置き場。メンバー抽選の画面は抽選のたびに作り直されるので、置き場はその外(画面の持ち主)に置き、
 * 作り直しても読み直さないようにする。次のサイクルの下ごしらえで先に読んでおくこともできる。
 * 読み込みは同時に `concurrency` 件まで(1件ずつ待つと人数分だけ遅くなるため)。同じ画像の読み込みは重ねない。
 * 読めなかった画像は黙って飛ばす(画面は代わりの絵を出す)。次の機会にまた読む。
 */
export class MemberImageCache {
  private readonly urls = new Map<string, string>();
  private readonly loading = new Map<string, Promise<void>>();

  constructor(
    private readonly loadUrl: MemberImageLoader,
    private readonly concurrency = MEMBER_IMAGE_CONCURRENCY
  ) {}

  get(assetId: string): string | undefined {
    return this.urls.get(assetId);
  }

  /** 読み込めている画像の数。 */
  get size(): number {
    return this.urls.size;
  }

  /** まだ読んでいないものを読み込む。すべて(失敗は除く)読み終えたら解決する。 */
  async preload(assetIds: Iterable<string | null | undefined>): Promise<void> {
    const wanted = [...new Set([...assetIds].filter((id): id is string => !!id))].filter((id) => !this.urls.has(id));
    let next = 0;
    const worker = async () => {
      while (next < wanted.length) await this.loadOnce(wanted[next++]);
    };
    await Promise.all(Array.from({ length: Math.min(this.concurrency, wanted.length) }, worker));
  }

  private loadOnce(assetId: string): Promise<void> {
    const inflight = this.loading.get(assetId);
    if (inflight) return inflight;
    const run = this.loadUrl(assetId)
      .then((url) => {
        if (url) this.urls.set(assetId, url);
      })
      .catch(() => undefined)
      .finally(() => this.loading.delete(assetId));
    this.loading.set(assetId, run);
    return run;
  }

  /** 持っている URL をすべて破棄する(抽選の画面を離れるとき)。 */
  clear(): void {
    for (const url of this.urls.values()) {
      try {
        URL.revokeObjectURL(url);
      } catch {
        /* noop */
      }
    }
    this.urls.clear();
  }
}

/** AssetDataService からメンバーの写真の URL を作る(blob は URL.createObjectURL、dataUrl・url はそのまま)。 */
export function createAssetImageLoader(assets: Pick<AssetDataService, "getAssetDataById">): MemberImageLoader {
  return async (assetId) => {
    const asset = (await assets.getAssetDataById(assetId)) as { blob?: Blob; dataUrl?: string; url?: string } | null;
    if (!asset) return null;
    if (asset.blob) return URL.createObjectURL(asset.blob);
    return asset.dataUrl ?? asset.url ?? null;
  };
}

let shared: MemberImageCache | null = null;

/** 抽選の画面全体で共有する置き場。メンバー抽選の画面が作り直されても残る。 */
export function sharedMemberImageCache(): MemberImageCache {
  shared ??= new MemberImageCache(createAssetImageLoader(container.resolve(AssetDataService)));
  return shared;
}

/** 共有の置き場を空にして手放す(抽選の画面を離れたとき)。 */
export function releaseSharedMemberImageCache(): void {
  shared?.clear();
  shared = null;
}
