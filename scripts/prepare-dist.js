// distディレクトリ集約用スクリプト
// 各serverプロジェクトのdist配下をdist/server/プロジェクト名/にコピー
// octopus-schedulerのdist配下をdist/client/octopus-scheduler/にコピー
// appsscript.jsonをdist直下にコピー

import {
  existsSync,
  mkdirSync,
  readdirSync,
  lstatSync,
  copyFileSync,
  rmSync,
  readFileSync,
} from "fs";
import { resolve, join, basename, dirname, relative } from "path";
import { fileURLToPath } from "url";
import { sync } from "glob";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = resolve(__dirname, "..");
const distDir = join(rootDir, "dist");
// GAS specific output directory (for clasp rootDir)
const gasDistDir = join(distDir, "gas");

// distディレクトリを初期化
if (existsSync(distDir)) {
  rmSync(distDir, { recursive: true, force: true });
}
mkdirSync(distDir, { recursive: true });
// Ensure gas-specific dir exists
mkdirSync(gasDistDir, { recursive: true });

// server, clientのdist配下を全て探索
const serverProjects = sync("src/server/**/", {
  cwd: rootDir,
  absolute: false,
  nodir: false,
}).filter(
  (p) =>
    (/^src\/server\/[^/]+\/?$/.test(p) ||
      /^src\/server\/[^/]+\/[^/]+\/?$/.test(p)) &&
    existsSync(join(rootDir, p, "dist")) &&
    !p.includes("shared-packages")
);
const clientProject = "src/client/octopus-scheduler";

function walkFiles(dir, callback, baseDir = dir) {
  for (const entry of readdirSync(dir)) {
    const fullPath = join(dir, entry);
    if (lstatSync(fullPath).isDirectory()) {
      walkFiles(fullPath, callback, baseDir);
    } else {
      const relPath = relative(baseDir, fullPath);
      callback(fullPath, relPath);
    }
  }
}

function isMaybeEsm(fullPath, relPath) {
  // Only check text-based script files to avoid reading binary assets.
  if (!/\.(js|mjs|cjs|ts|tsx)$/i.test(relPath)) return false;
  try {
    const content = readFileSync(fullPath, "utf8");
    // Look for top-level/line-starting import/export tokens. This is a heuristic
    // to detect ES module output like `export * from "..."` or `import ...`.
    // We avoid false positives for the word 'export' inside other words by
    // using word boundaries and look at line start positions.
    const esmPattern = /(^|\n)\s*(export\s+|import\s+|export\s*\*)/m;
    return esmPattern.test(content);
  } catch (e) {
    // If we can't read the file for some reason, be conservative and don't
    // treat it as ESM so it may still be copied. Log and continue.
    console.warn(`Warning: failed to read ${fullPath}: ${e.message}`);
    return false;
  }
}

// serverプロジェクトのdist配下をフラットにコピー

for (const proj of serverProjects) {
  const srcDist = join(rootDir, proj, "dist");
  if (!existsSync(srcDist)) continue;
  walkFiles(srcDist, (fullPath, relPath) => {
    // skip TypeScript declaration files
    if (/\.d\.ts$/i.test(relPath)) return;
    // skip ES module output that Apps Script can't parse
    if (isMaybeEsm(fullPath, relPath)) {
      console.log(`Skipping ESM file: ${relPath}`);
      return;
    }
    const fileName = relPath.split(/[\\/]/).pop();
    const destPath = join(distDir, fileName);
    copyFileSync(fullPath, destPath);

    // Also copy GAS-safe files into dist/gas (clasp rootDir)
    if (!isMaybeEsm(fullPath, relPath)) {
      const gasDest = join(gasDistDir, fileName);
      copyFileSync(fullPath, gasDest);
    }
  });
}

// clientプロジェクトのdist配下をフラットにコピー
const clientSrcDist = join(rootDir, clientProject, "dist");
if (existsSync(clientSrcDist)) {
  walkFiles(clientSrcDist, (fullPath, relPath) => {
    // skip TypeScript declaration files
    if (/\.d\.ts$/i.test(relPath)) return;
    // skip ES module output that Apps Script can't parse
    if (isMaybeEsm(fullPath, relPath)) {
      console.log(`Skipping ESM file: ${relPath}`);
      return;
    }
    const fileName = relPath.split(/[\\/]/).pop();
    const destPath = join(distDir, fileName);
    if (existsSync(destPath)) {
      // Intentionally overwrite without printing a warning to keep build output clean.
    }
    copyFileSync(fullPath, destPath);

    // Also copy GAS-safe files into dist/gas (clasp rootDir)
    if (!isMaybeEsm(fullPath, relPath)) {
      const gasDest = join(gasDistDir, fileName);
      copyFileSync(fullPath, gasDest);
    }
  });
}

// appsscript.jsonをdist直下にコピー
const appsscriptJson = join(rootDir, "appsscript.json");
if (existsSync(appsscriptJson)) {
  copyFileSync(appsscriptJson, join(distDir, "appsscript.json"));
  // also copy to gas dir for clasp
  copyFileSync(appsscriptJson, join(gasDistDir, "appsscript.json"));
}

console.log("dist直下へフラットに成果物を集約しました。");
