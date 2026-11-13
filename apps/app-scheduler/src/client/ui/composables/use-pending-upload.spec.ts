import "reflect-metadata";
import { afterEach, describe, expect, it, vi } from "vitest";
import { defineComponent, h } from "vue";
import { flushPromises, mount } from "@vue/test-utils";
import { container } from "tsyringe";
import { eventBus } from "@octopus/client-common/events/event-bus";
import { AssetRepository } from "@model/asset/asset-repository";
import { usePendingUpload } from "./use-pending-upload";

const entry = (id: string) => ({ id, name: `${id}.png`, mime: "image/png", hash: "h".repeat(32), size: 1, uploadedAt: "", lastUpdated: "" });
const meta = (id: string) => ({ driveDataId: id, fileId: "", parentFolderId: "", lastUpdate: "", fileName: `${id}.png` });

function mountWith(local: string[], remote: () => string[]) {
  container.registerInstance(AssetRepository, {
    readEntries: async () => local.map(entry),
    listRemote: async () => remote().map(meta),
  } as never);
  return mount(
    defineComponent({
      setup() {
        const { count } = usePendingUpload();
        return () => h("span", { "data-testid": "n" }, count.value === null ? "-" : String(count.value));
      },
    })
  );
}

afterEach(() => container.clearInstances());

describe("usePendingUpload(未アップロードの件数)", () => {
  it("この端末にあって、サーバーの一覧に無い素材の数。素材の追加と同期の終わりで数え直す", async () => {
    let remote = ["a"];
    const wrapper = mountWith(["a", "b", "c"], () => remote);
    await flushPromises();
    expect(wrapper.text()).toBe("2");
    remote = ["a", "b", "c"]; // アップロードが済んだ
    eventBus.emit("syncDone");
    await flushPromises();
    expect(wrapper.text()).toBe("0");
    remote = ["a"];
    window.dispatchEvent(new CustomEvent("assets:updated"));
    await flushPromises();
    expect(wrapper.text()).toBe("2");
  });

  it("数えられなければ、件数は出さない(0と取り違えない)。外れたら購読を外す", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    container.registerInstance(AssetRepository, { readEntries: async () => [], listRemote: async () => Promise.reject(new Error("offline")) } as never);
    const wrapper = mount(defineComponent({ setup() { const { count } = usePendingUpload(); return () => h("span", count.value === null ? "-" : String(count.value)); } }));
    await flushPromises();
    expect(wrapper.text()).toBe("-");
    const spy = vi.spyOn(eventBus, "off");
    wrapper.unmount();
    expect(spy).toHaveBeenCalledWith("syncDone", expect.any(Function));
  });
});
