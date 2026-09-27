import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    // gas/cloudflare配下のtsyringe @injectable() クラスをテストで直接
    // importする場合に必要なreflectポリフィル。
    setupFiles: ["reflect-metadata"],
  },
});
