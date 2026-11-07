import { computed } from "vue";
import { useCachedResource, type CachedResourceStorage } from "./use-cached-resource";

export interface CachedCollectionOptions<T extends { id: string }, TNew> {
  key: string;
  list: () => Promise<T[]>;
  /** サーバー側でID採番される場合があるため、追加だけは結果を待ってから一覧へ反映する。 */
  add: (input: TNew) => Promise<T>;
  update: (item: T) => Promise<unknown>;
  remove: (id: string) => Promise<unknown>;
  /** 複数件をまとめて削除する。あれば `remove` の代わりに1回で呼ぶ(無ければ1件ずつ `remove`)。 */
  removeMany?: (ids: string[]) => Promise<unknown>;
  storage?: CachedResourceStorage;
}

/**
 * id を持つ一覧(メンバー名簿など)の取得+追加/更新/削除。
 * 更新・削除は楽観的に反映し、失敗時は自動で巻き戻す。
 */
export function useCachedCollection<T extends { id: string }, TNew = Omit<T, "id"> & { id?: string }>(
  options: CachedCollectionOptions<T, TNew>
) {
  const resource = useCachedResource<T[]>({
    key: options.key,
    fetcher: options.list,
    initial: [],
    storage: options.storage,
  });

  const add = async (input: TNew) => {
    const added = await options.add(input);
    await resource.set([...resource.data.value, added]);
    return added;
  };

  const update = (item: T) =>
    resource.mutate(
      (list) => list.map((x) => (x.id === item.id ? item : x)),
      async () => {
        await options.update(item);
      }
    );

  const remove = (ids: string[]) => {
    if (options.removeMany && ids.length > 0) {
      const removeMany = options.removeMany;
      const drop = new Set(ids);
      // まとめて1回で確定させる(失敗時は全体を巻き戻す)
      return resource.mutate(
        (list) => list.filter((x) => !drop.has(x.id)),
        async () => {
          await removeMany(ids);
        }
      );
    }
    // 1件ずつ確定させ、途中で失敗しても成功分は戻さない
    return ids.reduce(
      (prev, id) =>
        prev.then(() =>
          resource.mutate(
            (list) => list.filter((x) => x.id !== id),
            async () => {
              await options.remove(id);
            }
          )
        ),
      Promise.resolve()
    );
  };

  return {
    items: computed(() => resource.data.value),
    loading: resource.loading,
    refreshing: resource.refreshing,
    error: resource.error,
    load: resource.load,
    refresh: resource.refresh,
    add,
    update,
    remove,
  };
}
