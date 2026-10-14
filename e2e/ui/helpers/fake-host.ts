import type { APIRequestContext } from "@playwright/test";
import { adminRpc } from "../fixtures";

/**
 * ホスト端末の代わり: 管理者として入室して、結果の保存と公開状態(イベント・クイズなど)の更新を行う。
 * 本番ではホストの HostAgent が行う。公開状態は名前空間ごとに差し替える(渡さなかったものは前のまま)。
 */
export async function fakeHost(request: APIRequestContext, sessionId: string) {
  const host = await adminRpc<{ deviceId: string; token: string }>(request, "sessionHub_joinOperator", {
    sessionId,
    role: "host",
    label: "E2E ホスト",
    deviceId: `e2e-host-${sessionId}`,
  });
  const data: Record<string, unknown> = {};
  const publish = (patch: Record<string, unknown>) => {
    Object.assign(data, patch);
    return adminRpc(request, "sessionHub_publishState", { sessionId, deviceId: host.deviceId, token: host.token, data: { ...data }, clientInput: [] });
  };
  const announce = (rev: number) => publish({ results: { rev } });
  return {
    publish,
    async quiz(result: Record<string, unknown>) {
      const { rev } = await adminRpc<{ rev: number }>(request, "sessionHub_putQuizResult", { sessionId, result });
      await announce(rev);
    },
    async draw(draw: Record<string, unknown>) {
      const { rev } = await adminRpc<{ rev: number }>(request, "sessionHub_putJackpotDraw", { sessionId, draw });
      await announce(rev);
    },
    async removeDraw(drawId: string) {
      const { rev } = await adminRpc<{ rev: number }>(request, "sessionHub_deleteJackpotDraw", { sessionId, drawId });
      await announce(rev);
    },
  };
}
