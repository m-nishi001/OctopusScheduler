import { useRoute, useRouter } from "vue-router";
import { container } from "tsyringe";
import { usePolling } from "@octopus/composables";
import { RemoteControlRepository } from "@model/remote-control/remote-control-repository";
import {
  REMOTE_SCREEN_ROUTES,
  shouldNavigateToRemoteScreen,
} from "@model/remote-control/remote-control-sync";

const POLL_INTERVAL_MS = 2000;

/**
 * 演出画面(本番スクリーン)側で使う。管理画面の「リモート操作」が設定した
 * 画面をポーリングし、現在のルートと異なれば自ら画面遷移する。リモート制御が
 * 一度も使われていない間(screenがnull)は何もしないため、同一デバイスでの
 * 既存のローカル画面遷移を一切妨げない。
 */
export function useRemoteScreenSync(): void {
  const router = useRouter();
  const route = useRoute();
  const repo = container.resolve(RemoteControlRepository);

  const { start } = usePolling(
    async () => {
      try {
        const state = await repo.getState();
        if (shouldNavigateToRemoteScreen(route.path, state.screen)) {
          router.push(REMOTE_SCREEN_ROUTES[state.screen!]);
        }
      } catch {
        // 一時的なポーリング失敗は無視し、次回のポーリングに委ねる
      }
    },
    POLL_INTERVAL_MS,
    { immediate: true }
  );
  start();
}
