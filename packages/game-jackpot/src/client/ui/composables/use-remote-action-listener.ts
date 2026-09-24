import { ref } from "vue";
import { container } from "tsyringe";
import { usePolling } from "@octopus/composables";
import { RemoteControlRepository } from "@model/remote-control/remote-control-repository";
import { shouldFireRemoteAdvance } from "@model/remote-control/remote-control-sync";

const POLL_INTERVAL_MS = 1000;

/**
 * 本抽選画面(演出画面)側で使う。管理画面の「リモート操作」の「次へ」ボタンを
 * ポーリングし、新しい進行操作を検知するたびonAdvanceを呼ぶ。onAdvanceには
 * 本番画面のEnterキー押下時と同じ関数(executeCurrentAction)を渡す想定。
 *
 * 必ずコンポーネントのsetup()の同期実行中(onMounted等の非同期コールバックの
 * 外)から呼び出すこと。usePollingが内部でonUnmountedを自動登録するため、
 * 非同期コールバック内から呼ぶとコンポーネントインスタンスを見失い、
 * unmount後もポーリングが止まらなくなる。
 */
export function useRemoteActionListener(onAdvance: () => void): void {
  const repo = container.resolve(RemoteControlRepository);
  const lastSeq = ref<number | null>(null);

  const { start } = usePolling(
    async () => {
      try {
        const state = await repo.getState();
        if (shouldFireRemoteAdvance(lastSeq.value, state.actionSeq)) {
          onAdvance();
        }
        lastSeq.value = state.actionSeq;
      } catch {
        // 一時的なポーリング失敗は無視し、次回のポーリングに委ねる
      }
    },
    POLL_INTERVAL_MS,
    { immediate: true }
  );
  start();
}
