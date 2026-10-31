import "reflect-metadata";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CloudflareApiClient } from "../cloudflare-api-client";
import { RateLimitedError } from "../../interfaces/api-client";

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
