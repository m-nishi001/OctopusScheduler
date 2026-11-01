import { getCurrentInstance, onBeforeUnmount, reactive } from "vue";
import { container } from "tsyringe";
import { mapPool } from "@octopus/sync-engine";
import { JackpotRepository } from "@model/jackpot-repository";

/** 素材の名前から中身を引く窓口(`JackpotRepository` がそのまま満たす)。 */
export interface BlobSource {
  blobOf(name: string): Promise<Blob | null>;
}

/**
 * 素材(画像・音声)の名前から、表示用の URL(object URL)を作って持つ。コンポーネントを離れるときにすべて破棄する。
 * 同じ名前は同じ素材なので、URL も名前ごとに1つだけ。
 */
export function useMediaUrls(source: BlobSource = container.resolve(JackpotRepository)) {
  const urls = reactive(new Map<string, string>());

  const drop = (name: string): void => {
    const url = urls.get(name);
    if (url) URL.revokeObjectURL(url);
    urls.delete(name);
  };

  /** 名前の表示用 URL。まだ読んでいない・素材が無いときは空。 */
  const urlOf = (name?: string | null): string => (name ? (urls.get(name) ?? "") : "");

  /** 手元の中身(選んだばかりのファイルなど)をその名前のプレビューにする。 */
  function show(name: string, blob: Blob): void {
    drop(name);
    urls.set(name, URL.createObjectURL(blob));
  }

  /** 名前の素材を保存されているものから読み直して、プレビューにする(並列)。素材が無い名前は外す。 */
  async function load(names: Iterable<string | null | undefined>): Promise<void> {
    const unique = [...new Set([...names].filter((n): n is string => !!n))];
    await mapPool(unique, async (name) => {
      try {
        const blob = await source.blobOf(name);
        if (blob) show(name, blob);
        else drop(name);
      } catch (e) {
        console.warn("[MediaUrls] failed to load media", name, e);
      }
    });
  }

  function revokeAll(): void {
    for (const url of urls.values()) URL.revokeObjectURL(url);
    urls.clear();
  }

  if (getCurrentInstance()) onBeforeUnmount(revokeAll);

  return { urlOf, show, load, revokeAll };
}
