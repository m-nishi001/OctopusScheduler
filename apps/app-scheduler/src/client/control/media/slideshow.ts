import { classifyMedia } from "@model/media/media-kind";
import type { ScreenSpec } from "@model/media/screen-spec";
import { StorageKind, StorageModule, storagePath } from "@octopus/infrastructures/compositions";
import type { AssetRecordEntry } from "../../../server/scheduler-api-contract";

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
  readEntries(): Promise<AssetRecordEntry[]>;
}

/**
 * 画像の ID の一覧。この端末の素材の一覧(`directoryId` が `…/assets/<フォルダ>`)から、名前順に作る。
 * 一覧だけを読み、中身の取得は `ensure` に任せる(サーバーへ一覧を取りに行かない)。
 */
export function folderImageLister(store: FolderStore): (folder: string) => Promise<string[]> {
  return async (folder) => {
    const directory = storagePath(StorageModule.Scheduler, StorageKind.Assets, folder);
    return (await store.readEntries())
      .filter((e) => e.directoryId === directory && classifyMedia(e.mime, e.name) === "image")
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((e) => e.id);
  };
}
