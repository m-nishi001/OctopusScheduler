import { container } from "tsyringe";

// This adapter provides a small, forgiving interface to the various draw APIs
// used across different components. It tries to resolve higher-level DrawService
// first, and falls back to lower-level repositories when needed.

export const DrawAdapter = {
  async executeFullDraw(): Promise<any> {
    try {
      const svc = container.resolve<any>("DrawService");
      if (svc && typeof svc.executeFullDraw === "function") {
        return await svc.executeFullDraw();
      }
    } catch (e) {
      // ignore - try fallback
    }

    try {
      const repo = container.resolve<any>("DrawRepository");
      if (repo && typeof repo.executeDraw === "function") {
        return await repo.executeDraw({});
      }
    } catch (e) {
      // ignore
    }

    throw new Error("No draw implementation available");
  },

  async executeMemberDraw(opts: any): Promise<any> {
    try {
      const svc = container.resolve<any>("DrawService");
      if (svc && typeof svc.executeMemberDraw === "function") {
        return await svc.executeMemberDraw(opts);
      }
    } catch (e) {}

    // fallback: try generic executeFullDraw and interpret
    return await DrawAdapter.executeFullDraw();
  },

  async executePrizeDraw(opts: any): Promise<any> {
    try {
      const svc = container.resolve<any>("DrawService");
      if (svc && typeof svc.executePrizeDraw === "function") {
        return await svc.executePrizeDraw(opts);
      }
    } catch (e) {}

    return await DrawAdapter.executeFullDraw();
  },
};

export default DrawAdapter;
