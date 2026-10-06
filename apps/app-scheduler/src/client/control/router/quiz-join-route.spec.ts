import { describe, it, expect } from "vitest";
import { createRouter, createMemoryHistory } from "vue-router";
import { createStandaloneQuizJoinRoutes } from "./quiz-join-route";

const Stub = { template: "<div />" };

describe("createStandaloneQuizJoinRoutes", () => {
  const gameRoutes = [
    { path: "/quiz-admin", component: Stub },
    { path: "/quiz/:id/join", name: "quiz-join", component: Stub },
  ];

  it("registers the participant join URL encoded in the QR code at the top level", () => {
    const router = createRouter({
      history: createMemoryHistory(),
      routes: createStandaloneQuizJoinRoutes(gameRoutes),
    });
    const resolved = router.resolve("/quiz/abc123/join");
    expect(resolved.name).toBe("quiz-join-standalone");
    expect(resolved.params.id).toBe("abc123");
    expect(resolved.matched).toHaveLength(1);
  });

  it("returns nothing when the game has no join route", () => {
    expect(createStandaloneQuizJoinRoutes([])).toEqual([]);
  });
});
