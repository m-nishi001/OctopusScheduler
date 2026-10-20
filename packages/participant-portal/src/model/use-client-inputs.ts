import { ref } from "vue";
import type { ComputedRef, Ref } from "vue";
import { parseHubErrorCode, stripHubErrorCode } from "@octopus/session-hub";
import type { PortalSession } from "./use-portal-session";

export interface ClientInputs {
  /** いまホストが受け付けている操作（"game.type" 形式）。空なら受付なし。 */
  inputs: ComputedRef<string[]>;
  /** 送信中の操作。 */
  busyKey: Ref<string | null>;
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
  const message = ref("");

  async function send(key: string): Promise<void> {
    if (busyKey.value !== null) return;
    const [game, type] = key.split(".");
    if (!game || !type) return;
    busyKey.value = key;
    message.value = "";
    try {
      await session.issue(game, type);
      message.value = "送信しました";
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

  return { inputs, busyKey, message, send };
}
