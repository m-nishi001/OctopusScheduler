#!/usr/bin/env node
/**
 * CI の e2e ジョブのログ(Playwright の list 出力、workers: 1)から、spec ごとの所要時間(秒)を集計して
 * e2e/shard-weights.json の ui / gas の表を作り直す。
 *
 * 使い方: node scripts/e2e-weights-from-logs.js <ログのファイル>...   → 更新後の shard-weights.json を標準出力へ
 *   ログは `gh api --allow-escape-sequences repos/<owner>/<repo>/actions/jobs/<job id>/logs` で取る(ui / gas のどちらでも混ぜてよい)。
 *   gas かどうかはログの中の `--target gas` で判別する。複数回分のログを渡すと、spec ごとに平均する。
 *   各テストの所要時間は「ひとつ前の結果行(最初は Running 行)との時刻の差」。スキップは 0 秒。
 *   e2e/ui にあるのにログに現れない spec は、既存の重みをそのまま残す。dedicated の重みも変えない。
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
// eslint-disable-next-line no-control-regex
const ANSI = /\x1b\[[0-9;]*m/g;
const RESULT = /^(\S+Z)\s+([✓✘-])\s+\d+\s+e2e\/ui\/([^:\s]+\.spec\.ts):/u;
const RUNNING = /^(\S+Z)\s+Running \d+ tests? using/;

/** 1 ジョブ分のログ → { target, seconds: { spec: 秒 } } */
export function parseJobLog(text) {
  const lines = text.replace(ANSI, "").split("\n");
  const target = lines.some((l) => /e2e-local\.js\s+--target gas/.test(l)) ? "gas" : "ui";
  const seconds = {};
  let prev = null;
  for (const line of lines) {
    const running = RUNNING.exec(line);
    if (running) {
      prev = Date.parse(running[1]);
      continue;
    }
    const m = RESULT.exec(line);
    if (!m || prev === null) continue;
    const at = Date.parse(m[1]);
    const delta = m[2] === "-" ? 0 : Math.max(0, (at - prev) / 1000);
    prev = Math.max(prev, at);
    seconds[m[3]] = (seconds[m[3]] ?? 0) + delta;
  }
  return { target, seconds };
}

/** 複数ジョブ(複数回の実行)の結果を、target と spec ごとに平均して整数秒にする */
export function averageWeights(jobs) {
  const acc = { ui: {}, gas: {} };
  for (const { target, seconds } of jobs) {
    for (const [spec, s] of Object.entries(seconds)) (acc[target][spec] ??= []).push(s);
  }
  const out = { ui: {}, gas: {} };
  for (const target of ["ui", "gas"]) {
    for (const [spec, list] of Object.entries(acc[target])) {
      out[target][spec] = Math.max(1, Math.round(list.reduce((a, b) => a + b, 0) / list.length));
    }
  }
  return out;
}

/** 既存の重みに測定値を上書きし、重い順に並べる(測れなかった spec と dedicated は既存のまま) */
export function mergeWeights(current, measured) {
  const dedicated = new Set(current.dedicated ?? []);
  const next = { ...current };
  for (const target of ["ui", "gas"]) {
    const merged = { ...current[target] };
    for (const [spec, s] of Object.entries(measured[target])) if (!dedicated.has(spec)) merged[spec] = s;
    next[target] = Object.fromEntries(Object.entries(merged).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])));
  }
  return next;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const files = process.argv.slice(2);
  if (files.length === 0) {
    console.error("使い方: node scripts/e2e-weights-from-logs.js <ログのファイル>...");
    process.exit(1);
  }
  const current = JSON.parse(readFileSync(join(ROOT, "e2e/shard-weights.json"), "utf8"));
  const measured = averageWeights(files.map((f) => parseJobLog(readFileSync(f, "utf8"))));
  console.log(JSON.stringify(mergeWeights(current, measured), null, 2));
}
