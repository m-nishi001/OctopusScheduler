import "reflect-metadata";
import { describe, it, expect, beforeEach } from "vitest";
import { flushPromises, mount } from "@vue/test-utils";
import { container } from "tsyringe";
import PrizeForm from "./prize-form.vue";
import MediaPicker from "../media-picker.vue";
import { JackpotRepository } from "@model/jackpot-repository";

const media = { "main.png": { hash: "h1", mime: "image/png", size: 1 }, "theme.mp3": { hash: "h2", mime: "audio/mpeg", size: 1 } };

beforeEach(() => {
  container.reset();
  container.registerInstance(JackpotRepository, {
    readRecord: async () => ({ prizes: [], screens: [], media }),
    blobOf: async () => null,
  } as unknown as JackpotRepository);
  URL.createObjectURL = () => "blob:preview";
  URL.revokeObjectURL = () => undefined;
});

const mountForm = async (props: Record<string, unknown>) => {
  const wrapper = mount(PrizeForm, { props: props as never });
  await flushPromises();
  return wrapper;
};
const submit = (wrapper: ReturnType<typeof mount>) => (wrapper.vm as unknown as { submit: () => void }).submit();
const chooseFile = async (picker: ReturnType<typeof mount>, file: File) => {
  const input = picker.find('input[type="file"]');
  Object.defineProperty(input.element, "files", { value: [file], configurable: true });
  await input.trigger("change");
};

describe("PrizeForm", () => {
  it("画像4つ・BGM2つを、同じ素材選択部品で並べる", async () => {
    const wrapper = await mountForm({ mode: "add" });
    expect(wrapper.findAllComponents(MediaPicker)).toHaveLength(6);
    for (const label of ["画像1", "画像2", "当選画像1", "当選画像2", "BGM1", "BGM2"]) expect(wrapper.text()).toContain(label);
  });

  it("登録済みの素材は、種類(画像 / 音声)に合う欄の選択肢に出る", async () => {
    const wrapper = await mountForm({ mode: "add" });
    const [image, , , , bgm] = wrapper.findAllComponents(MediaPicker);
    expect(image.findAll("option").map((o) => o.text())).toContain("main.png");
    expect(image.findAll("option").map((o) => o.text())).not.toContain("theme.mp3");
    expect(bgm.findAll("option").map((o) => o.text())).toContain("theme.mp3");
    expect(bgm.findAll("option").map((o) => o.text())).not.toContain("main.png");
  });

  it("exposes a weight field (not the removed rank field) defaulted for a new prize", async () => {
    const wrapper = await mountForm({ mode: "add" });
    expect(wrapper.text()).toContain("当選確率の重み");
    expect(wrapper.text()).not.toContain("景品ランク");
    expect((wrapper.find('input[type="number"]').element as HTMLInputElement).value).toBe("10");
  });

  it("loads an existing prize's weight and media names when editing", async () => {
    const wrapper = await mountForm({ mode: "edit", prize: { id: "p", name: "Grand Prize", weight: 80, image: "main.png" } });
    expect((wrapper.find('input[type="number"]').element as HTMLInputElement).value).toBe("80");
    expect(wrapper.find('[data-testid="media-name"]').text()).toBe("main.png");
  });

  describe("submit", () => {
    it("登録済みの素材を選ぶと名前が入り、ファイルは送らない。選んでいない欄は空(未設定)", async () => {
      const wrapper = await mountForm({ mode: "edit", prize: { id: "p1", name: "賞", bgm2: "keep.mp3" } });
      await wrapper.findAllComponents(MediaPicker)[0].find("select").setValue("main.png");
      submit(wrapper);
      const [payload] = wrapper.emitted("submit")![0] as [{ fields: Record<string, unknown>; files: Map<string, File> }];
      expect(payload.fields).toMatchObject({ name: "賞", image: "main.png", bgm2: "keep.mp3", image2: undefined });
      expect(payload.files.size).toBe(0);
    });

    it("ファイルを選ぶとその名前が入り、選んだばかりのファイルだけを名前つきで渡す。外した欄は未設定になる", async () => {
      const wrapper = await mountForm({ mode: "edit", prize: { id: "p1", name: "賞", image2: "main.png" } });
      const pickers = wrapper.findAllComponents(MediaPicker);
      const file = new File(["x"], "win.png", { type: "image/png" });
      await chooseFile(pickers[3], file);
      await pickers[1].find('[data-testid="media-remove"]').trigger("click");

      submit(wrapper);
      const [payload] = wrapper.emitted("submit")![0] as [{ fields: Record<string, unknown>; files: Map<string, File> }];
      expect(payload.fields).toMatchObject({ winningImage2: "win.png", image2: undefined });
      expect([...payload.files.keys()]).toEqual(["win.png"]);
      expect(payload.files.get("win.png")).toBe(file);
    });

    it("選んだばかりのファイルは、ほかの欄の登録済みの選択肢にも出る(同じ名前 = 同じ素材)", async () => {
      const wrapper = await mountForm({ mode: "add" });
      const pickers = wrapper.findAllComponents(MediaPicker);
      await chooseFile(pickers[0], new File(["x"], "fresh.png", { type: "image/png" }));
      expect(pickers[1].findAll("option").map((o) => o.text())).toContain("fresh.png");
    });

    it("名前が空なら送らない", async () => {
      const wrapper = await mountForm({ mode: "add" });
      submit(wrapper);
      expect(wrapper.emitted("submit")).toBeUndefined();
    });
  });

  describe("odds preview", () => {
    it("computes the win probability against the other prizes in the pool", async () => {
      const wrapper = await mountForm({ mode: "add", otherPrizes: [{ id: "p1", name: "A", weight: 90, order: 1 }] });
      // new prize defaults to weight 10 -> total = 90 + 10 = 100 -> 10.0%
      expect(wrapper.text()).toContain("約10.0%");
    });

    it("excludes the prize being edited from its own odds calculation", async () => {
      const wrapper = await mountForm({
        mode: "edit",
        prize: { id: "p1", name: "Grand Prize", weight: 50 },
        otherPrizes: [
          { id: "p1", name: "Grand Prize", weight: 50, order: 1 },
          { id: "p2", name: "B", weight: 50, order: 2 },
        ],
      });
      expect(wrapper.text()).toContain("約50.0%");
    });
  });
});
