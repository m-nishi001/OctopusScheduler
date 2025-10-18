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
} from "fs";
import { resolve, join, basename, dirname, relative } from "path";
import { fileURLToPath } from "url";
import { sync } from "glob";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = resolve(__dirname, "..");
const distDir = join(rootDir, "dist");

// distディレクトリを初期化
if (existsSync(distDir)) {
  rmSync(distDir, { recursive: true, force: true });
}
mkdirSync(distDir, { recursive: true });

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

// serverプロジェクトのdist配下をフラットにコピー

for (const proj of serverProjects) {
  const srcDist = join(rootDir, proj, "dist");
  if (!existsSync(srcDist)) continue;
  walkFiles(srcDist, (fullPath, relPath) => {
    // skip TypeScript declaration files
    if (/\.d\.ts$/i.test(relPath)) return;
    const fileName = relPath.split(/[\\/]/).pop();
    const destPath = join(distDir, fileName);
    if (existsSync(destPath)) {
      console.warn(`Warning: ${fileName} already exists in dist. Overwriting.`);
    }
    copyFileSync(fullPath, destPath);
  });
}

// clientプロジェクトのdist配下をフラットにコピー
const clientSrcDist = join(rootDir, clientProject, "dist");
if (existsSync(clientSrcDist)) {
  walkFiles(clientSrcDist, (fullPath, relPath) => {
    // skip TypeScript declaration files
    if (/\.d\.ts$/i.test(relPath)) return;
    const fileName = relPath.split(/[\\/]/).pop();
    const destPath = join(distDir, fileName);
    if (existsSync(destPath)) {
      console.warn(`Warning: ${fileName} already exists in dist. Overwriting.`);
    }
    copyFileSync(fullPath, destPath);
  });
}

// appsscript.jsonをdist直下にコピー
const appsscriptJson = join(rootDir, "appsscript.json");
if (existsSync(appsscriptJson)) {
  copyFileSync(appsscriptJson, join(distDir, "appsscript.json"));
}

console.log("dist直下へフラットに成果物を集約しました。");
