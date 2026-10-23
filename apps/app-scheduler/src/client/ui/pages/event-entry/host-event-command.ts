import { container } from "tsyringe";
import { HostAgent, PORTAL_EVENT_NS } from "@octopus/session-hub";

/**
 * エントリー画面(クイズ・ジャックポット)から、ホスト自身がイベントのコマンドを処理する。
 * 管理端末から届いたときと同じ経路(router.dispatch)を通す。ホストとして接続していないとき(プレビューなど)は何もしない。
 */
export async function hostEventCommand(type: string, requestPrefix: string): Promise<void> {
  if (!container.isRegistered(HostAgent)) return;
  const agent = container.resolve(HostAgent);
  if (!agent.active) return;
  await agent.router.dispatch({
    seq: 0,
    requestId: `${requestPrefix}-${type}`,
    game: PORTAL_EVENT_NS,
    type,
    payload: undefined,
    issuedBy: agent.connection.state.deviceId ?? "host",
    issuerRole: "host",
    atMs: Date.now(),
  });
}
