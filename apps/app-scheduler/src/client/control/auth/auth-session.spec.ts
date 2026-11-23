import { beforeEach, describe, expect, it, vi } from "vitest";

const store = vi.hoisted(() => ({ token: null as string | null }));
const repo = vi.hoisted(() => ({ getSession: vi.fn() }));

vi.mock("@octopus/client-common/auth/session-token-store", () => ({
  getSessionToken: () => store.token,
  setSessionToken: (t: string | null) => {
    store.token = t;
  },
}));
vi.mock("@octopus/accounts", () => ({ AccountsRepository: class AccountsRepository {} }));
vi.mock("tsyringe", () => ({ container: { resolve: () => repo } }));

async function load() {
  vi.resetModules();
  return import("./auth-session");
}

beforeEach(() => {
  store.token = "fake-token";
  repo.getSession.mockReset();
});

describe("ensureRole", () => {
  it("通信エラーのときは「確認できない」を返し、トークンを消さない", async () => {
    repo.getSession.mockRejectedValue(new Error("network"));
    const { ensureRole } = await load();
    expect(await ensureRole()).toBe("unverified");
    expect(store.token).toBe("fake-token");
    // 再試行は接続待ち画面のバックオフに任せる(API クライアント内部の再試行は使わない)
    expect(repo.getSession).toHaveBeenCalledWith("fake-token", { retries: 0 });
  });

  it("サーバーが null を返したら未ログイン(null)になり、トークンが消える", async () => {
    repo.getSession.mockResolvedValue(null);
    const { ensureRole } = await load();
    expect(await ensureRole()).toBeNull();
    expect(store.token).toBeNull();
  });

  it("通信エラーのあと、再試行して成功すると役割が返る", async () => {
    repo.getSession.mockRejectedValueOnce(new Error("timeout")).mockResolvedValueOnce({ id: "a", isAdmin: true });
    const { ensureRole } = await load();
    expect(await ensureRole()).toBe("unverified");
    expect(await ensureRole()).toBe("admin");
    expect(store.token).toBe("fake-token");
    expect(await ensureRole()).toBe("admin");
    expect(repo.getSession).toHaveBeenCalledTimes(2);
  });

  it("トークンが無ければサーバーに問い合わせず未ログイン", async () => {
    store.token = null;
    const { ensureRole } = await load();
    expect(await ensureRole()).toBeNull();
    expect(repo.getSession).not.toHaveBeenCalled();
  });
});
