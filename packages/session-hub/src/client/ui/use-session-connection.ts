import { onScopeDispose, shallowRef } from "vue";
import type { ShallowRef } from "vue";
import type { ConnectionState, SessionConnection } from "../model/session-connection";

export interface VisibilitySource {
  isVisible(): boolean;
  subscribe(listener: () => void): () => void;
}

/** ブラウザの可視状態(document.visibilityState)。document が無い環境では常に可視。 */
export function createDocumentVisibility(): VisibilitySource {
  return {
    isVisible: () => typeof document === "undefined" || document.visibilityState !== "hidden",
    subscribe(listener) {
      if (typeof document === "undefined") return () => {};
      document.addEventListener("visibilitychange", listener);
      return () => document.removeEventListener("visibilitychange", listener);
    },
  };
}

/**
 * SessionConnection の状態を Vue のリアクティブな参照として公開する。
 * スコープ(コンポーネント)が破棄されたら購読と接続を解放する。
 * 画面が非表示の間は取得間隔を延ばし(無料枠・GAS クォータの節約)、表示に戻れば即時取得する。
 */
export function useSessionConnection(
  connection: SessionConnection,
  visibility: VisibilitySource = createDocumentVisibility()
): { state: ShallowRef<ConnectionState>; connection: SessionConnection } {
  const state = shallowRef<ConnectionState>(connection.state);
  const unsubscribe = connection.subscribe((s) => {
    state.value = s;
  });
  const onVisibility = (): void => connection.setVisible(visibility.isVisible());
  const unsubscribeVisibility = visibility.subscribe(onVisibility);
  onVisibility();

  onScopeDispose(() => {
    unsubscribe();
    unsubscribeVisibility();
    connection.dispose();
  });
  return { state, connection };
}
