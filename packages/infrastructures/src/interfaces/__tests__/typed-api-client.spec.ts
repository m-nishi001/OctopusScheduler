import { describe, it, expect, vi } from "vitest";
import { createTypedApiClient } from "../typed-api-client";
import type { ApiCallOptions, IApiClient } from "../api-client";

interface FakeGameApi {
  addJson(args: { text: string }, options?: ApiCallOptions): Promise<{ id: string }>;
  getJson(fileId?: string, options?: ApiCallOptions): Promise<{ json: string }>;
}

describe("createTypedApiClient", () => {
  it("calls apiClient.call with the prefixed function name and forwards args/options", async () => {
    const call = vi.fn().mockResolvedValue({ id: "abc" });
    const apiClient: IApiClient = { call };

    const api = createTypedApiClient<FakeGameApi>(apiClient, "fakeGame", [
      "addJson",
      "getJson",
    ]);

    const result = await api.addJson({ text: "hello" });

    expect(call).toHaveBeenCalledWith("fakeGame_addJson", { text: "hello" }, undefined);
    expect(result).toEqual({ id: "abc" });
  });

  it("forwards ApiCallOptions as the third argument", async () => {
    const call = vi.fn().mockResolvedValue({ json: "{}" });
    const apiClient: IApiClient = { call };

    const api = createTypedApiClient<FakeGameApi>(apiClient, "fakeGame", [
      "addJson",
      "getJson",
    ]);

    await api.getJson(undefined, { timeout: 5000 });

    expect(call).toHaveBeenCalledWith("fakeGame_getJson", undefined, { timeout: 5000 });
  });

  it("throws when accessing an endpoint that is not in the allow-list", () => {
    const apiClient: IApiClient = { call: vi.fn() };
    const api = createTypedApiClient<FakeGameApi>(apiClient, "fakeGame", ["addJson"]);

    expect(() => (api as unknown as Record<string, unknown>).getJson).toThrow(
      /Unknown fakeGame endpoint: "getJson"/
    );
  });

  it("propagates rejection from apiClient.call", async () => {
    const call = vi.fn().mockRejectedValue(new Error("boom"));
    const apiClient: IApiClient = { call };
    const api = createTypedApiClient<FakeGameApi>(apiClient, "fakeGame", ["addJson"]);

    await expect(api.addJson({ text: "x" })).rejects.toThrow("boom");
  });
});
