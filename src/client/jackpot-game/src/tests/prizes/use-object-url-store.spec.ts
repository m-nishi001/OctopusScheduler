import { describe, it, expect, vi, beforeEach } from "vitest";
import { useObjectUrlStore } from "@composables/prizes/use-object-url-store";

describe("useObjectUrlStore", () => {
  let store: ReturnType<typeof useObjectUrlStore>;

  beforeEach(() => {
    store = useObjectUrlStore();
    // Clear any existing URLs
    store.revokeAll();
  });

  it("should create object URL and store it", () => {
    const mockFile = new File(["test"], "test.png", { type: "image/png" });
    const url = store.createObjectUrl(mockFile, "test-id");
    expect(url).toBeDefined();
    expect(store.getUrl("test-id")).toBe(url);
  });

  it("should set URL manually", () => {
    const testUrl = "https://example.com/image.png";
    store.setUrl("manual-id", testUrl);
    expect(store.getUrl("manual-id")).toBe(testUrl);
  });

  it("should revoke specific URL", () => {
    const mockFile = new File(["test"], "test.png", { type: "image/png" });
    const url = store.createObjectUrl(mockFile, "revoke-id");
    expect(store.getUrl("revoke-id")).toBe(url);

    const revokeSpy = vi.spyOn(URL, "revokeObjectURL");
    store.revoke("revoke-id");
    expect(revokeSpy).toHaveBeenCalledWith(url);
    expect(store.getUrl("revoke-id")).toBeUndefined();
  });

  it("should revoke all URLs", () => {
    const mockFile1 = new File(["test1"], "test1.png", { type: "image/png" });
    const mockFile2 = new File(["test2"], "test2.png", { type: "image/png" });
    const url1 = store.createObjectUrl(mockFile1, "id1");
    const url2 = store.createObjectUrl(mockFile2, "id2");

    const revokeSpy = vi.spyOn(URL, "revokeObjectURL");
    store.revokeAll();
    expect(revokeSpy).toHaveBeenCalledWith(url1);
    expect(revokeSpy).toHaveBeenCalledWith(url2);
    expect(store.objectUrlMap.size).toBe(0);
  });
});
