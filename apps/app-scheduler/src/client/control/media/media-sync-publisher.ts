import { container } from "tsyringe";
import type { HostAgent } from "@octopus/session-hub";
import { eventBus } from "@octopus/client-common/events/event-bus";
import { AssetRepository } from "@model/asset/asset-repository";
import { MEDIA_NS } from "@model/media/media-command";
import { MEDIA_SLICE_BUDGET_BYTES, diffPending, fromEntries, toCatalog } from "@model/media/media-catalog";
import type { CatalogItem, HostMediaSlice } from "@model/media/media-catalog";

export interface MediaSyncDeps {
  /** この端末(ホスト)の素材の一覧。 */
  readLocal(): Promise<CatalogItem[]>;
  /** サーバーの素材の一覧。 */
  readRemote(): Promise<CatalogItem[]>;
  now(): number;
}

const defaultDeps = (): MediaSyncDeps => ({
  readLocal: async () => fromEntries(await container.resolve(AssetRepository).readEntries()),
  readRemote: async () => toCatalog(await container.resolve(AssetRepository).listRemote()),
  now: () => Date.now(),
});

/**
 * ホストの素材の一覧とサーバーの一覧の差を、ルーム状態の `media` に公開する(管理端末が、アップロード前の素材も使えるように)。
 * 公開するのは、次のときだけ。
 *   - ホストとして入室したとき(前のホストが公開していた分を、必ず上書きする)
 *   - 素材を追加・削除したとき(`assets:updated`)
 *   - 同期が終わったとき(`syncDone`。アップロードが済めば `pending` が空になり、管理端末はサーバーの一覧を読み直す)
 * 持つ状態は、番号 `rev`、直近の再生の失敗 `lastError`、最後の同期でホストとサーバーが揃っていた素材 `synced` だけ。公開のたびに、一覧と差を読み直して作る。
 * `synced` は、「ホストで消した素材」(`removedIds`)を、「他の端末が足した素材を、ホストがまだ取り込んでいないだけ」と見分けるのに使う
 * (同期が終わるたびに取り直す。ホストが入室した直後は空で、最初の同期が終わるまで `removedIds` は出さない)。
 * `rev` は入室のたびに現在時刻から始める(ホストが替わっても、前のホストの番号と重ならない)。
 */
export function registerMediaSyncPublisher(
  agent: Pick<HostAgent, "active" | "connection" | "publishSlice">,
  deps: MediaSyncDeps = defaultDeps()
): { reportFailure(assetId: string): void; dispose(): void } {
  let rev = 0;
  let lastError: HostMediaSlice["lastError"];
  let synced: ReadonlySet<string> = new Set();
  let syncedStale = false;
  let running = false;
  let again = false;

  const publish = async (): Promise<void> => {
    // 公開の途中にまた呼ばれたら、重ねずに、終わってからもう1回だけ流す(最新の一覧で公開するため)
    if (running) {
      again = true;
      return;
    }
    running = true;
    try {
      do {
        again = false;
        if (!agent.active) return;
        let diff: ReturnType<typeof diffPending>;
        try {
          const refreshSynced = syncedStale;
          syncedStale = false;
          const [local, remote] = await Promise.all([deps.readLocal(), deps.readRemote().catch(() => null)]);
          if (refreshSynced && remote) {
            const localIds = new Set(local.map((i) => i.id));
            synced = new Set(remote.filter((i) => localIds.has(i.id)).map((i) => i.id));
          }
          diff = diffPending(local, remote ?? [], MEDIA_SLICE_BUDGET_BYTES, synced);
        } catch (error) {
          console.warn("素材の一覧を公開できませんでした", error);
          return;
        }
        rev += 1;
        const slice: HostMediaSlice = { rev, ...diff, ...(lastError ? { lastError } : {}) };
        await agent.publishSlice(MEDIA_NS, slice);
      } while (again);
    } finally {
      running = false;
    }
  };

  const onAssetsUpdated = () => void publish();
  let wasHost = false;
  const unsubscribe = agent.connection.subscribe((state) => {
    const isHost = state.phase === "connected" && state.role === "host";
    if (isHost && !wasHost) {
      rev = deps.now();
      synced = new Set();
      void publish();
    }
    wasHost = isHost;
  });
  window.addEventListener("assets:updated", onAssetsUpdated);
  // 同期が終わったときだけ、「ホストとサーバーが揃っていた素材」を取り直す
  const onSyncDone = () => {
    syncedStale = true;
    void publish();
  };
  eventBus.on("syncDone", onSyncDone);

  return {
    reportFailure(assetId) {
      lastError = { assetId, at: deps.now() };
      void publish();
    },
    dispose() {
      unsubscribe();
      window.removeEventListener("assets:updated", onAssetsUpdated);
      eventBus.off("syncDone", onSyncDone);
    },
  };
}
