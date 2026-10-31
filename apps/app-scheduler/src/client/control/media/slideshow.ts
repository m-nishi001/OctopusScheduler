import { classifyMedia } from "@model/media/media-kind";
import type { ScreenSpec } from "@model/media/screen-spec";
import { StorageKind, StorageModule, storagePath } from "@octopus/infrastructures/compositions";
import type { Asset } from "@model/asset/asset";
import type { DriveMetadata } from "@octopus/infrastructures/compositions";

type SlideshowSpec = Extract<ScreenSpec, { kind: "slideshow" }>;

export interface SlideshowDeps {
  /** そのフォルダの画像の ID を、表示する順に返す。 */
  listImageIds(folder: string): Promise<string[]>;
  /** 画像を使える状態にして返す。 */
  ensure(id: string): Promise<Blob>;
  sleep(ms: number): Promise<void>;
}

/**
 * スライドショーを進める。開始したら、そのフォルダの画像を先に `ensure` し始め、
 * 各スライドは、自分の画像の `ensure` が終わってから表示する。
 * 取得が遅いときは、前の画像が長めに映るだけで、画像が抜けることはない。
 * 返した `stop` を呼ぶと、以後は何も表示しない。
 */
export function runSlideshow(spec: SlideshowSpec, deps: SlideshowDeps, onShow: (image: Blob, index: number) => void): () => void {
  let active = true;
  void (async () => {
    const ids = await deps.listImageIds(spec.folder);
    if (!active || ids.length === 0) return;
    const loading = ids.map((id) => {
      const task = deps.ensure(id);
      task.catch(() => undefined);
      return task;
    });
    for (let i = 0; active; i = (i + 1) % ids.length) {
      const image = await loading[i].catch(() => deps.ensure(ids[i]).catch(() => null));
      if (!active) return;
      if (image) {
        onShow(image, i);
        if (ids.length === 1) return;
      }
      await deps.sleep(spec.intervalSec * 1000);
    }
  })().catch((error) => console.error("スライドショーを続けられませんでした", error));
  return () => {
    active = false;
  };
}

interface FolderStore {
  getAssets(): Promise<Asset[]>;
  listRemote(folder?: string): Promise<DriveMetadata[]>;
}

/** 画像の ID の一覧。この端末の素材(`directoryId` が `…/assets/<フォルダ>`)を先に使い、無いときだけサーバーの一覧を使う。 */
export function folderImageLister(
  store: FolderStore,
  ensure: (id: string, fileId?: string) => Promise<Blob>
): (folder: string) => Promise<string[]> {
  return async (folder) => {
    const directory = storagePath(StorageModule.Scheduler, StorageKind.Assets, folder);
    const local = (await store.getAssets())
      .filter((a) => a.directoryId === directory && classifyMedia(a.blob?.type, a.name) === "image")
      .sort((a, b) => a.name.localeCompare(b.name));
    if (local.length > 0) return local.map((a) => a.id);

    const remote = [...(await store.listRemote(folder))].sort((a, b) => a.fileId.localeCompare(b.fileId));
    const kinds = await Promise.all(
      remote.map(async (m) => {
        try {
          const blob = await ensure(m.driveDataId, m.fileId);
          return classifyMedia(blob.type, m.fileId) === "image";
        } catch {
          return false;
        }
      })
    );
    return remote.filter((_, i) => kinds[i]).map((m) => m.driveDataId);
  };
}
