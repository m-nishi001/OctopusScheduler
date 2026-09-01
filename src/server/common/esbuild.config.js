import { build as _build } from "esbuild";

const entryPoints = [
  "src/google-drive-service.ts",
  "src/google-spreadsheet-service.ts",
];
const outDir = "dist";

const build = async () => {
  console.log("Building TypeScript files:", entryPoints);

  await _build({
    entryPoints,
    outdir: outDir,
    bundle: true,
    target: "es2020",
    format: "iife",
    platform: "browser",
  })
    .then(() => console.log("ESBuild done"))
    .catch((err) => {
      console.error("ESBuild error:", err);
      process.exit(1);
    });

  console.log("Build completed successfully!");
};

build();
