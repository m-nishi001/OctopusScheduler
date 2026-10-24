#!/usr/bin/env node
/**
 * CI の e2e を、spec ファイルの所要時間(e2e/shard-weights.json)で均等な束(シャード)に分ける。
 *
 * Playwright の --shard は「テストの個数」で割るので、1 件が数分かかる重いテスト(jackpot-scale など)と
 * 一瞬で終わるテストが混ざると偏る。ここでは spec ファイルを丸ごと、重い順に最も軽い束へ入れていく(LPT 法)。
 * serial 指定の spec(describe.configure({ mode: "serial" }))は必ずファイル単位で同じ束になる。
 *
 * 使い方: node scripts/e2e-shards.js <ui|gas> <番号>/<束の数>   → その束の spec ファイルを空白区切りで出力する
 *   `dedicated` に挙げた spec は束に入れない(CI では Playwright の --shard で、その spec だけを別の job に分ける)。
 */
import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const SPEC_DIR = "e2e/ui";

export function loadWeights() {
  return JSON.parse(readFileSync(join(ROOT, "e2e/shard-weights.json"), "utf8"));
}

export function listSpecs(dir = join(ROOT, SPEC_DIR)) {
  return readdirSync(dir)
    .filter((f) => f.endsWith(".spec.ts"))
    .sort();
}

/** 束に入れる spec(dedicated を除く)を、重い順に最も軽い束へ入れる。結果は束ごとの spec 名の配列(各束はファイル名順)。 */
export function planShards(specs, weights, target, count) {
  if (!Number.isInteger(count) || count < 1) throw new Error(`束の数は 1 以上の整数にしてください: ${count}`);
  const table = weights[target];
  if (!table) throw new Error(`重みの対象が不明です: ${target}(${["ui", "gas"].join(" / ")})`);
  const dedicated = new Set(weights.dedicated ?? []);
  const items = specs
    .filter((s) => !dedicated.has(s))
    .map((s) => ({ spec: s, weight: table[s] ?? weights.default }))
    .sort((a, b) => b.weight - a.weight || a.spec.localeCompare(b.spec));
  const bins = Array.from({ length: count }, () => ({ total: 0, specs: [] }));
  for (const item of items) {
    const bin = bins.reduce((min, b) => (b.total < min.total ? b : min));
    bin.total += item.weight;
    bin.specs.push(item.spec);
  }
  return bins.map((b) => ({ total: b.total, specs: b.specs.sort() }));
}

export function main(argv = process.argv.slice(2)) {
  const [target, which] = argv;
  const m = /^(\d+)\/(\d+)$/.exec(which ?? "");
  if (!target || !m) throw new Error("使い方: node scripts/e2e-shards.js <ui|gas> <番号>/<束の数>");
  const index = Number(m[1]);
  const count = Number(m[2]);
  if (index < 1 || index > count) throw new Error(`番号は 1〜${count} にしてください: ${index}`);
  const bin = planShards(listSpecs(), loadWeights(), target, count)[index - 1];
  // 空の束で Playwright を引数なしで流すと全 spec が走ってしまう。黙って全部流すより、落とす。
  if (bin.specs.length === 0) throw new Error(`束 ${index}/${count} に spec がありません。束の数を減らしてください`);
  return bin.specs.map((s) => `${SPEC_DIR}/${s}`).join(" ");
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  try {
    console.log(main());
  } catch (e) {
    console.error(e.message);
    process.exit(1);
  }
}
