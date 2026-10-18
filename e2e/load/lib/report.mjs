// 試験項目(check)の記録と、結果の出力。1項目ずつ PASS / FAIL を出し、最後に計測の表と判定をまとめる。

import { writeFileSync } from "node:fs";
import { renderTimings } from "./metrics.mjs";

export class Report {
  /** @param {import("./metrics.mjs").Metrics} metrics */
  constructor(metrics) {
    this.metrics = metrics;
    this.checks = [];
    this.phases = [];
    this.startedAt = Date.now();
  }

  check(name, ok, detail = "") {
    const passed = Boolean(ok);
    this.checks.push({ name, ok: passed, detail: String(detail) });
    console.log(`${passed ? "PASS" : "FAIL"}  ${name}${detail ? `  (${detail})` : ""}`);
    return passed;
  }

  info(message) {
    console.log(`      ${message}`);
  }

  /** 1つの段階(フェーズ)を実行する。例外は FAIL として記録し、続行するかは呼び出し側が決める。 */
  async phase(name, fn) {
    const started = Date.now();
    console.log(`\n── ${name}`);
    try {
      const value = await fn();
      this.phases.push({ name, ms: Date.now() - started, ok: true });
      return { ok: true, value };
    } catch (e) {
      this.metrics.error("phase", `${name}: ${e?.message ?? e}`);
      this.check(`${name}: 途中で失敗`, false, e?.stack?.split("\n").slice(0, 3).join(" / ") ?? e);
      this.phases.push({ name, ms: Date.now() - started, ok: false });
      return { ok: false, error: e };
    }
  }

  /**
   * 基準値との比較(上限)。計測が無ければ失敗にする(測れていない = 検証できていない)。
   */
  gate(name, actual, limit, unit = "ms") {
    if (actual === null || actual === undefined) return this.check(`${name} ≤ ${limit}${unit}`, false, "計測なし");
    return this.check(`${name} ≤ ${limit}${unit}`, actual <= limit, `実測 ${actual}${unit}`);
  }

  finish({ reportPath, config }) {
    const summary = this.metrics.summary();
    const failed = this.checks.filter((c) => !c.ok);
    const unexpected = summary.errors.length;
    console.log("\n── 計測(ms)");
    console.log(renderTimings(summary));
    console.log("\n── 件数");
    for (const [name, n] of Object.entries(summary.counters)) console.log(`${name.padEnd(28)} ${n}`);
    if (summary.warnings?.length) {
      console.log("\n── 警告(再試行で回復したもの)");
      for (const w of summary.warnings.slice(0, 20)) console.log(`${w.kind}: ${w.detail}`);
    }
    if (unexpected) {
      console.log("\n── 想定外のエラー");
      for (const e of summary.errors.slice(0, 40)) console.log(`${e.kind}: ${e.detail}`);
      if (unexpected > 40) console.log(`... ほか ${unexpected - 40} 件`);
    }
    const ok = failed.length === 0 && unexpected === 0;
    console.log(`\n${this.checks.length - failed.length}/${this.checks.length} checks passed, 想定外のエラー ${unexpected} 件 → ${ok ? "合格" : "不合格"}`);
    console.log(`所要時間 ${Math.round((Date.now() - this.startedAt) / 1000)} 秒`);
    if (reportPath) {
      writeFileSync(
        reportPath,
        JSON.stringify({ ok, config, durationMs: Date.now() - this.startedAt, phases: this.phases, checks: this.checks, metrics: summary }, null, 2)
      );
      console.log(`レポート: ${reportPath}`);
    }
    return ok;
  }
}
