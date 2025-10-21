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
  // read package.json from package root
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

// list of internal identifiers used across server APIs
const internalNames = [
  "addDriveData",
  "getDriveMetaData",
  "getDriveData",
  "removeDriveData",
  "updateDriveData",
  "addSpreadsheetData",
  "getAllSpreadsheetNames",
  "getSpreadsheetData",
  "removeSpreadsheetData",
  "updateSpreadsheetData",
];

const bannerVars = internalNames.map((n) => `_${prefix}_${n}`).join(", ");

const footerFns = internalNames
  .map(
    (n) =>
      `function ${n}(...args) { return _${prefix}_${n}.apply(this, args); }`
  )
  .join("\n");

build({
  entryPoints: ["src/main.ts"],
  bundle: true,
  outfile: "dist/content-deck-api.js",
  target: "es2020",
  format: "iife",
  platform: "browser",
  banner: { js: `\nlet ${bannerVars};\n` },
  footer: { js: `\n${footerFns}\n` },
}).catch(() => process.exit(1));
