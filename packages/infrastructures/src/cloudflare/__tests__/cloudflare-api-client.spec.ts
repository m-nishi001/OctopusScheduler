import "reflect-metadata";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CloudflareApiClient } from "../cloudflare-api-client";
import { RateLimitedError } from "../../interfaces/api-client";
import type { BlobRoute } from "../../interfaces/api-client";
import { setSessionToken } from "@octopus/client-common/auth/session-token-store";

afterEach(() => vi.unstubAllGlobals());

function stubFetch(...responses: Response[]) {
  const fetchMock = vi.fn();
  for (const r of responses) fetchMock.mockResolvedValueOnce(r);
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

describe("CloudflareApiClient", () => {
  it("成功の応答の data を返す", async () => {
    stubFetch(new Response(JSON.stringify({ status: "success", data: { ok: 1 } })));
    expect(await new CloudflareApiClient().call("accounts_listMembers", {})).toEqual({ ok: 1 });
  });

  it("429 は Retry-After(秒)を持つ RateLimitedError にして、その場で再試行せずに投げる", async () => {
    const fetchMock = stubFetch(new Response("{}", { status: 429, headers: { "Retry-After": "7" } }));
    const error = await new CloudflareApiClient().call("accounts_listMembers", {}).catch((e) => e);
    expect(error).toBeInstanceOf(RateLimitedError);
    expect((error as RateLimitedError).retryAfterMs).toBe(7000);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("429 で Retry-After が無ければ60秒とみなす", async () => {
    stubFetch(new Response("{}", { status: 429 }));
    const error = await new CloudflareApiClient().call("x", {}).catch((e) => e);
    expect((error as RateLimitedError).retryAfterMs).toBe(60_000);
  });
});

describe("CloudflareApiClient のファイル送受信(バイナリ)", () => {
  const route: BlobRoute = { module: "octopus-scheduler", gasPut: "x_put", gasGet: "x_get" };
  const HASH = "a".repeat(32);
  const noWait = { retryDelay: 0 };

  it("putBlob: ファイルそのものを PUT /blobs/<module>/<hash> に送る(base64・JSON にしない)。トークンは Authorization ヘッダ", async () => {
    setSessionToken("tok");
    const fetchMock = stubFetch(new Response(null, { status: 204 }));
    const blob = new Blob([new Uint8Array([0, 255, 7])], { type: "video/mp4" });
    await new CloudflareApiClient().putBlob(route, HASH, blob);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(`/blobs/octopus-scheduler/${HASH}`);
    expect(init.method).toBe("PUT");
    expect(init.body).toBe(blob);
    expect(init.headers).toEqual({ Authorization: "Bearer tok", "Content-Type": "video/mp4" });
    setSessionToken(null);
  });

  it("getBlob: 返ってきたバイト列と種類のまま Blob にする", async () => {
    const fetchMock = stubFetch(new Response(new Uint8Array([0, 255, 7]), { headers: { "Content-Type": "image/png" } }));
    const blob = await new CloudflareApiClient().getBlob(route, HASH);
    expect(fetchMock.mock.calls[0][1].method).toBe("GET");
    expect(blob!.type).toBe("image/png");
    expect([...new Uint8Array(await blob!.arrayBuffer())]).toEqual([0, 255, 7]);
  });

  it("getBlob: サーバーに無ければ null", async () => {
    stubFetch(new Response("Not found", { status: 404 }));
    expect(await new CloudflareApiClient().getBlob(route, HASH)).toBeNull();
  });

  it("認証・ハッシュ不一致など 4xx は再試行せずに投げる。5xx は再試行する", async () => {
    const forbidden = stubFetch(new Response("Unauthorized", { status: 401 }));
    await expect(new CloudflareApiClient().putBlob(route, HASH, new Blob(["x"]), noWait)).rejects.toThrow(/HTTP 401/);
    expect(forbidden).toHaveBeenCalledTimes(1);

    const flaky = stubFetch(new Response("oops", { status: 503 }), new Response(null, { status: 204 }));
    await new CloudflareApiClient().putBlob(route, HASH, new Blob(["x"]), noWait);
    expect(flaky).toHaveBeenCalledTimes(2);
  });

  it("429 は Retry-After を持つ RateLimitedError にして、再試行せずに投げる", async () => {
    const fetchMock = stubFetch(new Response("", { status: 429, headers: { "Retry-After": "3" } }));
    const error = await new CloudflareApiClient().putBlob(route, HASH, new Blob(["x"]), noWait).catch((e) => e);
    expect(error).toBeInstanceOf(RateLimitedError);
    expect((error as RateLimitedError).retryAfterMs).toBe(3000);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
