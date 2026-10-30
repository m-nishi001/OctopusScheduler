import { afterEach, describe, expect, it } from "vitest";
import { createApp, nextTick, reactive } from "vue";
import type { App } from "vue";
import QuizModal from "./quiz-modal.vue";
import type { QuizDto } from "../../../../control/dto/quiz-dto";

function quizDto(correctNo: number): QuizDto {
  return {
    id: "q1",
    title: "t",
    question: "q",
    correctNo,
    timeLimit: 30,
    options: [1, 2, 3].map((no) => ({ no, text: `選択肢${no}`, color: "red", image: null })),
    bgm: null,
  };
}

let app: App | undefined;
let host: HTMLElement | undefined;

function mountModal(quiz: QuizDto) {
  host = document.createElement("div");
  document.body.appendChild(host);
  app = createApp(QuizModal, { isEditing: true, currentQuiz: quiz });
  app.mount(host);
  return host;
}

const select = () => document.body.querySelector("select") as HTMLSelectElement;
const click = (el: Element) => (el as HTMLElement).click();
const buttonByLabel = (label: string) =>
  Array.from(document.body.querySelectorAll("button")).find((b) => b.textContent?.includes(label) || b.getAttribute("aria-label") === label)!;

afterEach(() => {
  app?.unmount();
  host?.remove();
  document.body.innerHTML = "";
});

describe("QuizModal の正解", () => {
  it("正解を3にして選択肢を追加しても、正解は3のまま", async () => {
    const quiz = reactive(quizDto(3));
    mountModal(quiz);
    await nextTick();
    expect(select().value).toBe("3");

    click(buttonByLabel("選択肢を追加"));
    await nextTick();
    const input = document.body.querySelector("#quiz-option-form input[type=text]") as HTMLInputElement;
    input.value = "新しい選択肢";
    input.dispatchEvent(new Event("input"));
    (document.body.querySelector("#quiz-option-form") as HTMLFormElement).dispatchEvent(new Event("submit", { cancelable: true }));
    await nextTick();

    expect(quiz.options.map((o) => o.no)).toEqual([1, 2, 3, 4]);
    expect(quiz.correctNo).toBe(3);
    expect(select().value).toBe("3");
  });

  it("正解でない選択肢を削除しても正解は保たれ、正解を削除すると先頭の選択肢の no に移る", async () => {
    const quiz = reactive(quizDto(3));
    mountModal(quiz);
    await nextTick();

    click(document.body.querySelectorAll('button[aria-label="削除"]')[0]);
    await nextTick();
    expect(quiz.options.map((o) => o.no)).toEqual([2, 3]);
    expect(quiz.correctNo).toBe(3);
    expect(select().value).toBe("3");

    click(document.body.querySelectorAll('button[aria-label="削除"]')[1]);
    await nextTick();
    expect(quiz.options.map((o) => o.no)).toEqual([2]);
    expect(quiz.correctNo).toBe(2);
    expect(select().value).toBe("2");
  });
});
