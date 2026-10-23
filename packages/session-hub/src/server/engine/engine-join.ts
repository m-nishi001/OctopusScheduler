/** セッションへの入室(運営者・参加者)。 */
import { DEVICE_ID_PATTERN, HOST_STALE_MS } from "../../shared/session-types";
import type { Device, SessionMeta } from "../../shared/session-types";
import type { JoinOperatorArgs, JoinPortalArgs, JoinResult } from "../../shared/protocol";
import { cleanLabel, isAlive, loadMeta, safeEqual } from "./engine-core";
import type { EngineDeps } from "./engine-core";
import { hubError } from "./hub-error";
import type { StoredHead } from "./session-repo";

function toJoinResult(meta: SessionMeta, device: Device, head: StoredHead | null): JoinResult {
  return {
    session: meta,
    deviceId: device.deviceId,
    token: device.token,
    role: device.role,
    head: { seq: head?.seq ?? 0, stateVersion: head?.stateVersion ?? 0 },
  };
}

/** ログイン済みの運営者(ホスト/管理)として入室する。呼び出し側が管理者認証を済ませていること。 */
export async function joinOperator(
  deps: EngineDeps,
  args: JoinOperatorArgs,
  memberId: string
): Promise<JoinResult> {
  const now = deps.now();
  const meta = await loadMeta(deps.repo, now);
  if (args.role !== "host" && args.role !== "admin") {
    throw hubError("INVALID_ARGUMENT", "role は host か admin を指定してください");
  }

  // 同じ端末としての復帰(リロード)。端末IDはクライアントが採番して送るため、入室の応答が
  // 失われて再送されたときも、同じIDなら前回作った端末をそのまま返す(冪等)。
  // IDが他人/他の役割の端末と衝突した場合は流用せず、サーバが新しいIDを採番する。
  const requestedId = args.deviceId && DEVICE_ID_PATTERN.test(args.deviceId) ? args.deviceId : undefined;
  let device: Device | null = null;
  let newDeviceId = deps.newId();
  if (requestedId) {
    const existing = await deps.repo.getDevice(requestedId);
    if (!existing) newDeviceId = requestedId;
    else if (existing.role === args.role && existing.memberId === memberId) device = existing;
  }

  if (args.role === "host" && meta.hostDeviceId && meta.hostDeviceId !== device?.deviceId) {
    const presence = await deps.presence.list();
    const current = presence.find((p) => p.deviceId === meta.hostDeviceId);
    if (isAlive(current, now, HOST_STALE_MS) && !args.takeover) {
      throw hubError(
        "HOST_ALREADY_CONNECTED",
        `別のホスト端末(${current?.label ?? "不明"})が接続中です。引き継ぐ場合は確認してください`
      );
    }
  }

  const label = cleanLabel(args.label, args.role === "host" ? "ホスト" : "管理");
  if (!device) {
    device = {
      deviceId: newDeviceId,
      sessionId: meta.id,
      role: args.role,
      memberId,
      label,
      token: deps.newToken(),
      joinedAtMs: now,
    };
    await deps.repo.putDevice(device);
  } else if (device.label !== label) {
    device = { ...device, label };
    await deps.repo.putDevice(device);
  }

  if (args.role === "host" && (meta.hostDeviceId !== device.deviceId || meta.status === "lobby")) {
    await deps.repo.putMeta({ ...meta, hostDeviceId: device.deviceId, status: "live" });
  }
  await deps.presence.touch({
    deviceId: device.deviceId,
    role: device.role,
    label: device.label,
    seenAtMs: now,
    ackSeq: 0,
  });
  return toJoinResult(
    { ...meta, hostDeviceId: args.role === "host" ? device.deviceId : meta.hostDeviceId, status: args.role === "host" ? "live" : meta.status },
    device,
    await deps.repo.getHead()
  );
}

/** サーバーがログインから確定した参加者。クライアントの申告(memberId / label)は使わない。 */
export interface TrustedMember {
  memberId: string;
  label: string;
}

/** ログイン済みの参加者として入室する。メンバーはサーバーが確定したもの(trusted)だけを使う。 */
export async function joinParticipant(deps: EngineDeps, args: JoinPortalArgs, trusted: TrustedMember): Promise<JoinResult> {
  const now = deps.now();
  const meta = await loadMeta(deps.repo, now);

  if (args.deviceId && args.token) {
    const existing = await deps.repo.getDevice(args.deviceId);
    // ログイン済みの参加者は、同じメンバーの端末にだけ復帰させる(共有端末で別の人に引き継がれないように)。
    if (existing && existing.memberId === trusted.memberId && existing.role === "client" && safeEqual(existing.token, args.token)) {
      await deps.presence.touch({
        deviceId: existing.deviceId,
        role: "client",
        label: existing.label,
        seenAtMs: now,
        ackSeq: 0,
      });
      return toJoinResult(meta, existing, await deps.repo.getHead());
    }
  }

  const device: Device = {
    deviceId: deps.newId(),
    sessionId: meta.id,
    role: "client",
    memberId: trusted.memberId,
    label: cleanLabel(trusted.label, "参加者"),
    token: deps.newToken(),
    joinedAtMs: now,
  };
  await deps.repo.putDevice(device);
  // 新しい端末のときだけ名簿に載せる(復帰した端末は、すでに載っている)。
  await deps.repo.addParticipant(trusted.memberId);
  await deps.presence.touch({
    deviceId: device.deviceId,
    role: "client",
    label: device.label,
    seenAtMs: now,
    ackSeq: 0,
  });
  return toJoinResult(meta, device, await deps.repo.getHead());
}
