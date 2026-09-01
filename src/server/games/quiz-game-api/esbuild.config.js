import { build } from "esbuild";
import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
const __dirname = dirname(fileURLToPath(import.meta.url));

function toCamelCase(name) {
  return name
    .replace(/[-_]+(.)?/g, (_, c) => (c ? c.toUpperCase() : ""))
    .replace(/^(.)/, (m) => m.toLowerCase());
}

function derivePrefix() {
  const pkgPath = join(__dirname, "package.json");
  try {
    const pkg = JSON.parse(readFileSync(pkgPath, "utf8"));
    const raw = (pkg.name || "").replace(/-api$/, "");
    return toCamelCase(raw);
  } catch (e) {
    return "package";
  }
}

const prefix = derivePrefix();

const internalNames = [
  "stopForm",
  "getSheetData",
  "stopAndGetProcessedResults",
  "loadEmailNameMap",
  "getMappedResponses",
  "addDriveData",
  "getDriveMetaData",
  "getDriveData",
  "removeDriveData",
  "updateDriveData",
  "addJson",
  "getJson",
  "addJsonData",
  "getJsonData",
  "listJsonMetaData",
  "updateJsonData",
  "trashFolderContents",
];

const bannerVars = internalNames.map((n) => `_${prefix}_${n}`).join(", ");
const footerFns = internalNames
  .map(
    (n) =>
      `function ${prefix}_${n}(...args) { return _${prefix}_${n}.apply(this, args); }`
  )
  .join("\n");

build({
  entryPoints: ["src/main.ts"],
  bundle: true,
  outfile: "dist/quiz-game-api.js",
  target: "es2020",
  format: "iife",
  platform: "browser",
  banner: { js: `\nlet ${bannerVars};\n` },
  footer: { js: `\n${footerFns}\n` },
}).catch(() => process.exit(1));
