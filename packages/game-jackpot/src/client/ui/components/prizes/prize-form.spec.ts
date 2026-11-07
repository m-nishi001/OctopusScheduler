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

  it("景品ランク(1〜5、標準3)の欄を持ち、新しい景品は3が入る。旧「当選確率の重み」は出さない", async () => {
    const wrapper = await mountForm({ mode: "add" });
    expect(wrapper.text()).toContain("景品ランク（1〜5、標準3、5=豪華でレア）");
    expect(wrapper.text()).not.toContain("当選確率の重み");
    const input = wrapper.find('input[type="number"]');
    expect((input.element as HTMLInputElement).value).toBe("3");
    expect(input.attributes("min")).toBe("1");
    expect(input.attributes("max")).toBe("5");
  });

  it("範囲外の入力は1〜5にそろえて、景品ランクとして送る", async () => {
    const wrapper = await mountForm({ mode: "add" });
    await wrapper.find('.name-field input').setValue("賞");
    await wrapper.find('input[type="number"]').setValue("9");
    submit(wrapper);
    const [payload] = wrapper.emitted("submit")![0] as [{ fields: Record<string, unknown> }];
    expect(payload.fields).toMatchObject({ name: "賞", rank: 5 });
    expect(payload.fields).not.toHaveProperty("weight");
  });

  it("loads an existing prize's rank and media names when editing", async () => {
    const wrapper = await mountForm({ mode: "edit", prize: { id: "p", name: "Grand Prize", rank: 5, image: "main.png" } });
    expect((wrapper.find('input[type="number"]').element as HTMLInputElement).value).toBe("5");
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
      const wrapper = await mountForm({ mode: "add", otherPrizes: [{ id: "p1", name: "A", rank: 1, order: 1 }, { id: "p2", name: "B", rank: 2, order: 2 }] });
      // 他の景品の重み 5 + 4、新しい景品は標準ランク3 -> 重み3 -> 3 / 12 = 25.0%
      expect(wrapper.text()).toContain("約25.0%");
    });

    it("excludes the prize being edited from its own odds calculation", async () => {
      const wrapper = await mountForm({
        mode: "edit",
        prize: { id: "p1", name: "Grand Prize", rank: 5 },
        otherPrizes: [
          { id: "p1", name: "Grand Prize", rank: 5, order: 1 },
          { id: "p2", name: "B", rank: 1, order: 2 },
        ],
      });
      // 自分(ランク5 -> 重み1)と B(ランク1 -> 重み5): 1 / 6 = 16.7%
      expect(wrapper.text()).toContain("約16.7%");
    });
  });
});
