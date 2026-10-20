import { describe, expect, it } from "vitest";
import { createTestHub } from "../../../testing";
import * as svc from "../session-service";
import { parseHubErrorCode } from "../../../shared/hub-error";
import { SESSION_TTL_MS } from "../../../shared/session-types";

async function code(promise: Promise<unknown>): Promise<string | null> {
  try {
    await promise;
    return null;
  } catch (e) {
    return parseHubErrorCode((e as Error).message) ?? (e as Error).message;
  }
}

const ALICE = { id: "alice", name: "アリス" };
const BOB = { id: "bob", name: "ボブ" };

async function setup() {
  const hub = createTestHub();
  const a = await svc.createSession(hub.deps, { name: "受付会場" }, "admin1");
  const b = await svc.createSession(hub.deps, { name: "別会場" }, "admin1");
  return { hub, a, b };
}

const portalIds = async (hub: ReturnType<typeof createTestHub>) =>
  (await svc.listSessions(hub.deps)).filter((s) => s.portal === true).map((s) => s.id);

describe("setPortalSession", () => {
  it("セッションを参加者ポータルの入口として公開し、止められる", async () => {
    const { hub, a } = await setup();
    expect(await portalIds(hub)).toEqual([]);
    await svc.setPortalSession(hub.deps, { sessionId: a.id, published: true });
    expect(await portalIds(hub)).toEqual([a.id]);
    await svc.setPortalSession(hub.deps, { sessionId: a.id, published: false });
    expect(await portalIds(hub)).toEqual([]);
  });

  it("公開は同時に1つだけ。別のセッションを公開すると前のは外れる", async () => {
    const { hub, a, b } = await setup();
    await svc.setPortalSession(hub.deps, { sessionId: a.id, published: true });
    await svc.setPortalSession(hub.deps, { sessionId: b.id, published: true });
    expect(await portalIds(hub)).toEqual([b.id]);
  });

  it("別のセッションの公開を止めても、公開中のセッションは変わらない", async () => {
    const { hub, a, b } = await setup();
    await svc.setPortalSession(hub.deps, { sessionId: a.id, published: true });
    await svc.setPortalSession(hub.deps, { sessionId: b.id, published: false });
    expect(await portalIds(hub)).toEqual([a.id]);
  });

  it("存在しない・終了したセッションは公開できず、終了すると公開から外れる", async () => {
    const { hub, a, b } = await setup();
    expect(await code(svc.setPortalSession(hub.deps, { sessionId: "ghost", published: true }))).toBe("SESSION_NOT_FOUND");
    expect(await code(svc.setPortalSession(hub.deps, { sessionId: "", published: true }))).toBe("INVALID_ARGUMENT");

    await svc.setPortalSession(hub.deps, { sessionId: a.id, published: true });
    await svc.closeSession(hub.deps, { sessionId: a.id });
    expect(await portalIds(hub)).toEqual([]);
    expect(await code(svc.setPortalSession(hub.deps, { sessionId: a.id, published: true }))).toBe("SESSION_CLOSED");
    // 終了済みを公開しようとして失敗しても、他のセッションの状態は壊れない
    await svc.setPortalSession(hub.deps, { sessionId: b.id, published: true });
    expect(await portalIds(hub)).toEqual([b.id]);
  });
});

describe("joinPortal", () => {
  it("公開中のセッションに、参加コード無しで、ログイン中のメンバーとして入る", async () => {
    const { hub, a } = await setup();
    await svc.setPortalSession(hub.deps, { sessionId: a.id, published: true });
    const joined = await svc.joinPortal(hub.deps, {}, ALICE);
    expect(joined.session.id).toBe(a.id);
    expect(joined.role).toBe("client");
    const device = await hub.deps.repoFor(a.id).getDevice(joined.deviceId);
    expect(device).toMatchObject({ role: "client", memberId: "alice", label: "アリス" });
  });

  it("公開中のセッションが無ければ入れない", async () => {
    const { hub } = await setup();
    expect(await code(svc.joinPortal(hub.deps, {}, ALICE))).toBe("SESSION_NOT_FOUND");
  });

  it("公開を止めた後、またはセッションが終了した後は入れない", async () => {
    const { hub, a } = await setup();
    await svc.setPortalSession(hub.deps, { sessionId: a.id, published: true });
    await svc.setPortalSession(hub.deps, { sessionId: a.id, published: false });
    expect(await code(svc.joinPortal(hub.deps, {}, ALICE))).toBe("SESSION_NOT_FOUND");
    await svc.setPortalSession(hub.deps, { sessionId: a.id, published: true });
    await svc.closeSession(hub.deps, { sessionId: a.id });
    expect(await code(svc.joinPortal(hub.deps, {}, ALICE))).toBe("SESSION_NOT_FOUND");
  });

  it("有効期限が切れたセッションには入れない", async () => {
    const { hub, a } = await setup();
    await svc.setPortalSession(hub.deps, { sessionId: a.id, published: true });
    hub.clock.advance(SESSION_TTL_MS + 1000);
    expect(await code(svc.joinPortal(hub.deps, {}, ALICE))).toBe("SESSION_NOT_FOUND");
  });

  it("同じメンバーが保存した入室情報で入り直すと、同じ端末として復帰する", async () => {
    const { hub, a } = await setup();
    await svc.setPortalSession(hub.deps, { sessionId: a.id, published: true });
    const first = await svc.joinPortal(hub.deps, {}, ALICE);
    const again = await svc.joinPortal(hub.deps, { deviceId: first.deviceId, token: first.token }, ALICE);
    expect(again.deviceId).toBe(first.deviceId);
    expect(again.token).toBe(first.token);
  });

  it("別のメンバーが前の人の入室情報を持っていても、その人の端末には復帰せず新しい端末になる(共有端末対策)", async () => {
    const { hub, a } = await setup();
    await svc.setPortalSession(hub.deps, { sessionId: a.id, published: true });
    const alice = await svc.joinPortal(hub.deps, {}, ALICE);
    const bob = await svc.joinPortal(hub.deps, { deviceId: alice.deviceId, token: alice.token }, BOB);
    expect(bob.deviceId).not.toBe(alice.deviceId);
    expect(bob.token).not.toBe(alice.token);
    const device = await hub.deps.repoFor(a.id).getDevice(bob.deviceId);
    expect(device).toMatchObject({ memberId: "bob", label: "ボブ" });
  });

  it("誤ったトークンでは復帰せず、新しい端末になる", async () => {
    const { hub, a } = await setup();
    await svc.setPortalSession(hub.deps, { sessionId: a.id, published: true });
    const first = await svc.joinPortal(hub.deps, {}, ALICE);
    const again = await svc.joinPortal(hub.deps, { deviceId: first.deviceId, token: "wrong" }, ALICE);
    expect(again.deviceId).not.toBe(first.deviceId);
  });
});
