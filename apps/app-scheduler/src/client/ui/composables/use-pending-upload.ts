import { onMounted, onUnmounted, ref } from "vue";
import { container } from "tsyringe";
import { eventBus } from "@octopus/client-common/events/event-bus";
import { AssetRepository } from "@model/asset/asset-repository";
import { diffPending, fromEntries, toCatalog } from "@model/media/media-catalog";

/**
 * まだサーバーにアップロードされていない素材の件数(この端末の一覧にあって、サーバーの一覧に無いもの)。
 * 素材の追加・削除と、同期が終わるたびに数え直す。同期は画面を離れても続くので、戻ってくれば 0 になっている。
 */
export function usePendingUpload() {
  const count = ref<number | null>(null);

  const refresh = async () => {
    try {
      const repository = container.resolve(AssetRepository);
      const [local, remote] = await Promise.all([repository.readEntries(), repository.listRemote()]);
      count.value = diffPending(fromEntries(local), toCatalog(remote), Infinity, new Set()).pending.length;
    } catch (error) {
      console.warn("未アップロードの件数を数えられませんでした", error);
    }
  };
  const onChange = () => void refresh();

  onMounted(() => {
    void refresh();
    window.addEventListener("assets:updated", onChange);
    eventBus.on("syncDone", onChange);
  });
  onUnmounted(() => {
    window.removeEventListener("assets:updated", onChange);
    eventBus.off("syncDone", onChange);
  });
  return { count };
}
