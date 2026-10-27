import { ref, watch } from "vue";
import type { ComputedRef, Ref } from "vue";
import { parseHubErrorCode, stripHubErrorCode } from "@octopus/session-hub";
import type { PortalSession } from "./use-portal-session";

export interface ClientInputs {
  /** いまホストが受け付けている操作（"game.type" 形式）。空なら受付なし。 */
  inputs: ComputedRef<string[]>;
  /** 送信中の操作。 */
  busyKey: Ref<string | null>;
  /** 送信に成功して、ホストが状態を公開し直す(inputs が変わる)のを待っている操作。 */
  waitingKeys: Ref<string[]>;
  /** 失敗の案内。成功では何も出さない(押した結果は画面の変化で伝わる)。 */
  message: Ref<string>;
  send(key: string): Promise<void>;
}

/**
 * ホストが許可した参加者の操作（例: ルーレットを止める）。受け付けている操作はホストが公開する
 * （RoomState.clientInput のうち、自分が宛先のもの）。押すと、ホストへコマンドとして届く。
 */
export function useClientInputs(session: PortalSession): ClientInputs {
  const inputs = session.clientInputs;
  const busyKey = ref<string | null>(null);
  const waitingKeys = ref<string[]>([]);
  const message = ref("");

  // ホストが公開し直して、その操作の受付が無くなったら(停止の演出が始まった)、待ちを解く。
  // 通信が遅くても、公開が届くまで同じ操作を押せないようにして二重押しを防ぐ。
  watch(inputs, (keys) => {
    if (waitingKeys.value.some((k) => !keys.includes(k))) waitingKeys.value = waitingKeys.value.filter((k) => keys.includes(k));
  });

  async function send(key: string): Promise<void> {
    if (busyKey.value !== null || waitingKeys.value.includes(key)) return;
    const [game, type] = key.split(".");
    if (!game || !type) return;
    busyKey.value = key;
    message.value = "";
    try {
      await session.issue(game, type);
      waitingKeys.value = [...waitingKeys.value, key];
    } catch (error) {
      const text = error instanceof Error ? error.message : String(error);
      const code = parseHubErrorCode(text);
      message.value =
        code === "FORBIDDEN"
          ? "受付が終了しました"
          : code
            ? stripHubErrorCode(text)
            : "通信できませんでした。電波の良い場所でもう一度お試しください。";
    } finally {
      busyKey.value = null;
    }
  }

  return { inputs, busyKey, waitingKeys, message, send };
}
