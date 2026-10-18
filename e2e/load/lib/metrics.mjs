// 負荷テストの計測。所要時間の分布(p50/p95/p99)、件数、想定外のエラーを集める。

export function percentile(sortedAsc, p) {
  if (sortedAsc.length === 0) return null;
  const rank = Math.min(sortedAsc.length - 1, Math.max(0, Math.ceil((p / 100) * sortedAsc.length) - 1));
  return sortedAsc[rank];
}

export class Metrics {
  constructor() {
    /** @type {Map<string, number[]>} */
    this.timings = new Map();
    /** @type {Map<string, number>} */
    this.counters = new Map();
    /** @type {Array<{kind: string, detail: string}>} */
    this.errors = [];
    /** @type {Array<{kind: string, detail: string}>} */
    this.warnings = [];
  }

  time(name, ms) {
    const list = this.timings.get(name);
    if (list) list.push(ms);
    else this.timings.set(name, [ms]);
  }

  count(name, n = 1) {
    this.counters.set(name, (this.counters.get(name) ?? 0) + n);
  }

  /** 想定外のエラー(試験の失敗として数える)。 */
  error(kind, detail) {
    this.errors.push({ kind, detail: String(detail).slice(0, 300) });
    this.count(`error:${kind}`);
  }

  /** 再試行などで回復した問題(試験の失敗にはしないが、報告する)。 */
  warn(kind, detail) {
    this.warnings.push({ kind, detail: String(detail).slice(0, 300) });
    this.count(`warn:${kind}`);
  }

  stats(name) {
    const list = [...(this.timings.get(name) ?? [])].sort((a, b) => a - b);
    if (list.length === 0) return null;
    const sum = list.reduce((a, b) => a + b, 0);
    return {
      n: list.length,
      min: list[0],
      mean: Math.round(sum / list.length),
      p50: percentile(list, 50),
      p95: percentile(list, 95),
      p99: percentile(list, 99),
      max: list[list.length - 1],
    };
  }

  summary() {
    const timings = {};
    for (const name of [...this.timings.keys()].sort()) timings[name] = this.stats(name);
    return { timings, counters: Object.fromEntries([...this.counters].sort(([a], [b]) => a.localeCompare(b))), errors: this.errors, warnings: this.warnings };
  }
}

/** 表形式で出力する(ms)。 */
export function renderTimings(summary) {
  const rows = Object.entries(summary.timings);
  if (rows.length === 0) return "";
  const pad = (v, n) => String(v ?? "-").padStart(n);
  const nameWidth = Math.max(...rows.map(([name]) => name.length), 4);
  const head = `${"計測".padEnd(nameWidth)} ${pad("n", 6)} ${pad("p50", 7)} ${pad("p95", 7)} ${pad("p99", 7)} ${pad("max", 7)}`;
  const body = rows.map(([name, s]) => `${name.padEnd(nameWidth)} ${pad(s.n, 6)} ${pad(s.p50, 7)} ${pad(s.p95, 7)} ${pad(s.p99, 7)} ${pad(s.max, 7)}`);
  return [head, ...body].join("\n");
}
