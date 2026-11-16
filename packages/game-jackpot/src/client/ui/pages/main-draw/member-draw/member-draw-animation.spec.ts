import "reflect-metadata";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { container } from "tsyringe";
import { mount } from "@vue/test-utils";
import { MemberPhotoCache } from "@octopus/accounts";
import { ScreenSettingsService } from "@control/screen-config/screen-settings-service";

const bgm = vi.hoisted(() => ({ playRandom: vi.fn(), fadeOut: vi.fn(), stop: vi.fn() }));
vi.mock("../use-lottery-bgm", async (orig) => ({ ...(await orig<typeof import("../use-lottery-bgm")>()), useLotteryBgm: () => bgm }));
const settings = vi.hoisted(() => vi.fn());

import MemberDrawAnimation from "./member-draw-animation.vue";

describe("メンバー抽選の停止", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    container.clearInstances();
    settings.mockResolvedValue({ memberResultBgms: ["r.mp3"] });
    container.registerInstance(ScreenSettingsService, { fetchScreenSetting: settings } as unknown as ScreenSettingsService);
    container.registerInstance(MemberPhotoCache, { ensure: vi.fn().mockResolvedValue(undefined), get: vi.fn(), has: vi.fn() } as unknown as MemberPhotoCache);
  });

  it("停止が始まったら、メンバー抽選BGMはすぐ止めずにフェードアウトする", async () => {
    const wrapper = mount(MemberDrawAnimation, { props: { members: [], externalDialog: true } });
    const vm = wrapper.vm as unknown as { startDraw(id: string | null): void; stopDraw(sec?: number): Promise<string | null> };

    vm.startDraw(null);
    await vi.waitFor(() => expect(bgm.playRandom).toHaveBeenCalledTimes(1));

    await vm.stopDraw(5).catch(() => null); // 画面の大きさが無い jsdom では止める先が見つからなくてよい
    expect(bgm.fadeOut).toHaveBeenCalledTimes(1);
    expect(bgm.stop).not.toHaveBeenCalled();
    wrapper.unmount();
  });

  it("結果BGMが空なら、停止が始まってもフェードアウトせず、止まってからフェードアウトする", async () => {
    settings.mockResolvedValue({ memberResultBgms: [] });
    const wrapper = mount(MemberDrawAnimation, { props: { members: [], externalDialog: true } });
    const vm = wrapper.vm as unknown as { startDraw(id: string | null): void; stopDraw(sec?: number): Promise<string | null>; stopAt: (id: string | null, sec?: number) => Promise<string | null> };

    vm.startDraw(null);
    await vi.waitFor(() => expect(bgm.playRandom).toHaveBeenCalledTimes(1));

    const stopping = vm.stopDraw(5).catch(() => null);
    await vi.waitFor(() => expect(settings).toHaveBeenCalled());
    expect(bgm.fadeOut).not.toHaveBeenCalled(); // 停止の開始ではまだ止めない(jsdom では止まる前に終わるので、ここまで)
    await stopping;
    wrapper.unmount();
  });

  it("結果ダイアログが開いたら結果BGMを流し、閉じたらすぐ止める", async () => {
    const wrapper = mount(MemberDrawAnimation, { props: { members: [], externalDialog: true } });
    const vm = wrapper.vm as unknown as { onWinnerDialogShown(): void; onWinnerDialogClosed(): void };

    vm.onWinnerDialogShown();
    expect(bgm.playRandom).toHaveBeenCalledTimes(1);
    expect(bgm.stop).not.toHaveBeenCalled();
    vm.onWinnerDialogClosed();
    expect(bgm.stop).toHaveBeenCalledTimes(1);
    wrapper.unmount();
  });
});
