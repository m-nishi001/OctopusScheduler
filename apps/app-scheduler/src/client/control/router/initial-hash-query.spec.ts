import { describe, it, expect } from "vitest";
import { createMemoryHistory, createRouter } from "vue-router";
import { hashToPath } from "./initial-hash";

describe("initial hash with query (QR code URL of a demo session)", () => {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [{ path: "/quiz/:id/join", component: { render: () => null } }],
  });

  it("keeps ?demo=1 when resolved before navigating", async () => {
    const path = hashToPath("quiz/abc/join?demo=1")!;
    const { path: resolvedPath, query } = router.resolve(path);
    await router.push({ path: resolvedPath, query, replace: true });

    expect(router.currentRoute.value.query.demo).toBe("1");
  });

  it("documents that embedding the query in a path object drops it", async () => {
    await router.push({ path: "/quiz/abc/join?demo=1" });

    expect(router.currentRoute.value.query.demo).toBeUndefined();
  });
});
