import { describe, expect, it } from "vitest";
import { mount } from "@vue/test-utils";
import MediaPicker from "./media-picker.vue";

const mountPicker = (props: Record<string, unknown> = {}) =>
  mount(MediaPicker, { props: { label: "画像1", kind: "image", modelValue: "", options: ["a.png", "b.png"], previewUrl: "", ...props } as never });

const chooseFile = async (wrapper: ReturnType<typeof mountPicker>, file: File) => {
  const input = wrapper.find('input[type="file"]');
  Object.defineProperty(input.element, "files", { value: [file], configurable: true });
  await input.trigger("change");
};

describe("MediaPicker", () => {
  it("未設定なら『なし』を出し、外すボタンは出さない", () => {
    const w = mountPicker();
    expect(w.text()).toContain("画像1なし");
    expect(w.find('[data-testid="media-name"]').text()).toBe("未設定");
    expect(w.find('[data-testid="media-remove"]').exists()).toBe(false);
  });

  it("登録済みの素材を選択肢に並べ、選ぶと名前を返す", async () => {
    const w = mountPicker();
    expect(w.findAll("option").map((o) => o.text())).toEqual(["登録済みの素材から選ぶ", "a.png", "b.png"]);
    await w.find("select").setValue("b.png");
    expect(w.emitted("update:modelValue")).toEqual([["b.png"]]);
  });

  it("ファイルを選ぶと、ファイルを pick で渡し、その名前を値にする", async () => {
    const w = mountPicker();
    const file = new File(["x"], "new.png", { type: "image/png" });
    await chooseFile(w, file);
    expect(w.emitted("pick")).toEqual([[file]]);
    expect(w.emitted("update:modelValue")).toEqual([["new.png"]]);
  });

  it("画像はプレビューを表示し、音声は再生部品を出す。外すと空にする", async () => {
    const image = mountPicker({ modelValue: "a.png", previewUrl: "blob:img" });
    expect(image.find("img").attributes("src")).toBe("blob:img");
    expect(image.find('[data-testid="media-name"]').text()).toBe("a.png");
    await image.find('[data-testid="media-remove"]').trigger("click");
    expect(image.emitted("update:modelValue")).toEqual([[""]]);

    const audio = mountPicker({ kind: "audio", label: "BGM1", modelValue: "t.mp3", previewUrl: "blob:aud" });
    expect(audio.find("audio").attributes("src")).toBe("blob:aud");
    expect(audio.find('input[type="file"]').attributes("accept")).toBe("audio/*");
  });
});
