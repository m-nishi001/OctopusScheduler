/** 更新の組み立て(在席・コマンド・状態・回答ラウンド)と、ポーリングによる取得。 */
import { ADMIN_ALIVE_MS, CLIENT_ALIVE_MS, COMMAND_RING_SIZE } from "../../shared/session-types";
import type { Command, DeviceRole, PresenceEntry, PresenceView, RoomState, SessionMeta } from "../../shared/session-types";
import type { PollArgs, PollResult, RoundSummary } from "../../shared/protocol";
import { computeNextPollMs } from "../../shared/poll-interval";
import { EMPTY_HEAD, authenticate, isAlive } from "./engine-core";
import type { EngineDeps } from "./engine-core";
import { toRoundSummary } from "./engine-rounds";
import type { StoredHead } from "./session-repo";

export function buildPresenceView(
  entries: PresenceEntry[],
  hostDeviceId: string | null,
  now: number
): PresenceView {
  const host = entries.find((e) => e.deviceId === hostDeviceId) ?? null;
  return {
    host,
    admins: entries.filter((e) => e.role === "admin" && isAlive(e, now, ADMIN_ALIVE_MS)),
    clientCount: entries.filter((e) => e.role === "client" && isAlive(e, now, CLIENT_ALIVE_MS)).length,
  };
}

/** 更新1件(PollResult)を作るのに必要な読み取り。ポーリングと WebSocket の push で共通に使う。 */
export interface UpdateSource {
  meta: SessionMeta;
  head: StoredHead;
  presence: PresenceView;
  now: number;
  /** 現在の RoomState(未公開は null)。同じ push の中で何度呼ばれても1回の読み取りで済むようメモ化して渡す。 */
  getState: () => Promise<RoomState | null>;
  getCommand: (seq: number) => Promise<Command | null>;
  /** 回答ラウンドの要約。運営端末(ホスト/管理)の更新にだけ使う。 */
  getRound?: () => Promise<RoundSummary | null>;
}

/**
 * ある端末(role, 手元の seq / state version)に送る更新を組み立てる。
 * 参加者には運営向けのコマンドを渡さない(進行の中身を露出させない)。
 */
export async function buildUpdate(
  src: UpdateSource,
  role: DeviceRole,
  sinceSeq: number,
  stateVersion: number
): Promise<PollResult> {
  const { meta, head } = src;
  let commands: Command[] = [];
  let resync = false;
  if (role !== "client") {
    const since = Math.max(0, sinceSeq);
    if (since > head.seq) {
      // 手元の方が先に進んでいる(セッションが作り直された等)。取り直させる。
      resync = true;
    } else if (head.seq - since > COMMAND_RING_SIZE) {
      resync = true;
    } else {
      for (let seq = since + 1; seq <= head.seq; seq++) {
        const cmd = await src.getCommand(seq);
        if (!cmd || cmd.seq !== seq) {
          resync = true;
          commands = [];
          break;
        }
        commands.push(cmd);
      }
    }
  }

  const needState = head.stateVersion !== stateVersion || resync;
  const state = needState && head.stateVersion > 0 ? await src.getState() : null;

  return {
    session: { id: meta.id, name: meta.name, mode: meta.mode, status: meta.status, hostDeviceId: meta.hostDeviceId },
    serverTimeMs: src.now,
    head: { seq: head.seq, stateVersion: head.stateVersion },
    commands,
    resync,
    state,
    presence: src.presence,
    round: role !== "client" && head.hasRound && src.getRound ? await src.getRound() : null,
    nextPollMs: computeNextPollMs(role, src.now - head.updatedAtMs),
  };
}

/** 差分の取得(コマンド・状態・在席)と、次回までの間隔の指示。 */
export async function poll(deps: EngineDeps, args: PollArgs): Promise<PollResult> {
  const { meta, device } = await authenticate(deps, args);
  const now = deps.now();
  const head = (await deps.repo.getHead()) ?? EMPTY_HEAD(meta);

  const entries = await deps.presence.touch({
    deviceId: device.deviceId,
    role: device.role,
    label: device.label,
    seenAtMs: now,
    ackSeq: device.role === "host" ? Math.max(0, args.ackSeq ?? 0) : 0,
  });

  return buildUpdate(
    {
      meta,
      head,
      presence: buildPresenceView(entries, meta.hostDeviceId, now),
      now,
      getState: () => deps.repo.getState(),
      getCommand: (seq) => deps.repo.getCommand(seq),
      getRound: async () => toRoundSummary(await deps.repo.getRound(), now),
    },
    device.role,
    args.sinceSeq,
    args.stateVersion
  );
}
