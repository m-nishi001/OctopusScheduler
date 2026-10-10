import "reflect-metadata";
import { describe, it, expect, beforeAll } from "vitest";
import { container } from "tsyringe";
import { AssetDataService } from "@control/asset/asset-data-service";
import { mount } from "@vue/test-utils";
import PrizeWinningDialog from "./prize-winning-dialog.vue";

const mountDialog = (prize: Record<string, unknown>) =>
  mount(PrizeWinningDialog, {
    props: { title: "景品当選", prize },
    global: { stubs: { teleport: true } },
  });

describe("prize-winning-dialog", () => {
  beforeAll(() => {
    container.registerInstance(AssetDataService, { getAssetDataById: async () => null } as any);
  });

  /** 画像が未設定の賞品でも、当たった賞品名が必ず表示されること(黒い画面+見出しだけにならない)。 */
  it("画像なしの賞品でも賞品名を表示する", () => {
    const w = mountDialog({ id: "p1", name: "特賞 ハワイ旅行", order: 1 });
    expect(w.get("[data-testid=prize-winning-name]").text()).toBe("特賞 ハワイ旅行");
  });

  it("極端に長い賞品名でも折り返せるクラスを持つ", () => {
    const w = mountDialog({ id: "p1", name: "あ".repeat(200), order: 1 });
    expect(w.get(".prize-name").text()).toHaveLength(200);
  });
});
