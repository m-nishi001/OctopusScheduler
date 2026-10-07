import { describe, it, expect } from "vitest";
import { DemoQuizSession, LiveQuizSession } from "./quiz-session";

describe("QuizSession", () => {
  it("live keeps production routes and has no join query", () => {
    const session = new LiveQuizSession();
    expect(session.scope).toBe("live");
    expect(session.routeName("quiz-play")).toBe("quiz-play");
    expect(session.joinUrlQuery).toBe("");
  });

  it("demo uses preview routes and the demo join query", () => {
    const session = new DemoQuizSession();
    expect(session.scope).toBe("demo");
    expect(session.routeName("quiz-play")).toBe("quiz-play-preview");
    expect(session.joinUrlQuery).toBe("?demo=1");
  });
});
