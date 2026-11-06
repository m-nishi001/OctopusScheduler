import { computed, reactive, ref, watch } from "vue";
import type { WatchSource } from "vue";
import { container } from "tsyringe";
import { JackpotRepository } from "@model/jackpot-repository";
import { useMediaUrls } from "./use-media-urls";

export type MediaKind = "image" | "audio";

/** 種類(画像 / 音声)に合う MIME か。 */
export const isKind = (mime: string, kind: MediaKind): boolean => mime.startsWith(`${kind}/`);

/**
 * 素材の選択部品(`MediaPicker`)を使うフォームの、素材まわりの状態をまとめたもの。
 * - 登録済みの素材(このモジュールのレコードの索引)の一覧
 * - 選んだばかりでまだ保存していないファイル(名前 → ファイル)。同じ名前 = 同じ素材なので、名前だけで参照する
 * - プレビュー用の URL
 * 保存のときは {@link filesFor} で、参照している名前のうち新しく選んだファイルだけを保存に渡す。
 */
export function useMediaDraft() {
  const repo = container.resolve(JackpotRepository);
  const urls = useMediaUrls(repo);
  const registered = ref<Record<string, { mime: string }>>({});
  const pending = reactive(new Map<string, File>());

  /** 登録済みの素材を読み直す。 */
  async function reload(): Promise<void> {
    registered.value = (await repo.readRecord()).media;
  }

  /** 選べる素材の名前(登録済み + 選んだばかり)。 */
  const optionsOf = (kind: MediaKind): string[] => {
    const names = new Set(Object.entries(registered.value).filter(([, m]) => isKind(m.mime, kind)).map(([name]) => name));
    for (const f of pending.values()) if (isKind(f.type, kind)) names.add(f.name);
    return [...names];
  };

  /** ファイルを選んだ。名前で参照できるようになり、すぐプレビューできる。 */
  function pick(file: File): string {
    pending.set(file.name, file);
    urls.show(file.name, file);
    return file.name;
  }

  /** 参照している名前のうち、新しく選んだファイルだけ(保存に渡す)。 */
  const filesFor = (names: Iterable<string | null | undefined>): Map<string, File> => {
    const out = new Map<string, File>();
    for (const n of names) if (n && pending.has(n)) out.set(n, pending.get(n)!);
    return out;
  };

  /** 参照している名前のプレビューを、保存されている素材から用意する(選んだばかりのものは、すでにある)。 */
  const track = (names: WatchSource<(string | null | undefined)[]>): void => {
    watch(names, (list) => void urls.load(list.filter((n) => !!n && !pending.has(n))), { immediate: true, deep: true });
  };

  return { registered: computed(() => registered.value), reload, optionsOf, pick, filesFor, track, urlOf: urls.urlOf };
}
