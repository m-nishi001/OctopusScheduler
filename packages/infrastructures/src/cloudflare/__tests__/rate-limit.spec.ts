import { describe, expect, it } from "vitest";
import { allowRequest, clientKey, limiterKindForRpc, tooManyRequests } from "../rate-limit";
import type { CloudflareEnv } from "../env";

function envWith(limiters: Partial<Pick<CloudflareEnv, "LOGIN_LIMITER" | "PUBLIC_LIMITER">>): CloudflareEnv {
  return limiters as unknown as CloudflareEnv;
}

describe("limiterKindForRpc", () => {
  it("ログインは厳格、それ以外は公開用", () => {
    expect(limiterKindForRpc("accounts_login")).toBe("login");
    expect(limiterKindForRpc("sessionHub_poll")).toBe("public");
    expect(limiterKindForRpc(undefined)).toBe("public");
  });
});

describe("clientKey", () => {
  it("CF-Connecting-IP を使い、無ければ共通キー", () => {
    expect(clientKey(new Request("https://x/", { headers: { "CF-Connecting-IP": "1.2.3.4" } }))).toBe("1.2.3.4");
    expect(clientKey(new Request("https://x/"))).toBe("unknown");
  });
});

describe("allowRequest", () => {
  it("バインディング未設定なら許可する", async () => {
    expect(await allowRequest(envWith({}), "login", "k")).toBe(true);
  });

  it("種別ごとのリミッタをキーつきで呼び、結果を返す", async () => {
    const calls: string[] = [];
    const make = (name: string, success: boolean) => ({
      limit: async ({ key }: { key: string }) => {
        calls.push(`${name}:${key}`);
        return { success };
      },
    });
    const env = envWith({ LOGIN_LIMITER: make("login", false), PUBLIC_LIMITER: make("public", true) });
    expect(await allowRequest(env, "login", "ip")).toBe(false);
    expect(await allowRequest(env, "public", "ip")).toBe(true);
    expect(calls).toEqual(["login:ip", "public:ip"]);
  });
});

describe("tooManyRequests", () => {
  it("429 でリトライ不可を返す", async () => {
    const res = tooManyRequests();
    expect(res.status).toBe(429);
    expect(await res.json()).toMatchObject({ status: "error", retryable: false });
  });
});
