import type { AnswerData, RawRow } from "../types/quiz";
import { normalizeEmail, normalizeAnswer } from "../types/quiz";

export type ComputeOptions = {
  answerKey: string; // ヘッダー名そのまま
  correctValue: string; // 文字列一致で判定
  limit?: number;
  uniqueByEmail?: boolean;
  excludeMissingEmail?: boolean;
  quizStartTimeMs: number; // クライアントが記録する開始時刻
};

export function toSecondsString(seconds: number | null): string | null {
  if (seconds === null || typeof seconds !== "number" || Number.isNaN(seconds))
    return null;
  return seconds.toFixed(3) + "秒";
}

export function computeTopResponders(
  answers: AnswerData[],
  options: ComputeOptions
): AnswerData[] {
  const {
    answerKey,
    correctValue,
    limit = 10,
    uniqueByEmail = true,
    excludeMissingEmail = true,
    quizStartTimeMs,
  } = options;

  if (!Array.isArray(answers)) return [];

  // 1) 正答フィルタ（正規化した文字列の一致）かつ有効なタイムスタンプ
  const normCorrect = normalizeAnswer(correctValue);
  const filtered = answers.filter((r) => {
    if (!r) return false;
    const val = r[answerKey];
    if (val === undefined || val === null) return false;
    const normVal = normalizeAnswer(String(val));
    if (normVal !== normCorrect) return false;
    const t = r.__timestampMs;
    if (t === undefined || t === null || Number.isNaN(Number(t))) return false;
    return true;
  });

  // 2) uniqueByEmail の場合は email ごとに最後（最大の __timestampMs）を採用
  const emailKeyNames = Object.keys(filtered[0] || {}).filter((k) =>
    /メール|mail|email|Email/i.test(k)
  );
  // 優先: 明示的に 'メールアドレス' があるならそれを使う
  let emailHeader: string | null = null;
  if (emailKeyNames.length > 0) {
    // prefer header exactly matches common Japanese header
    const exact = emailKeyNames.find((h) => h === "メールアドレス");
    emailHeader = exact || emailKeyNames[0];
  }

  const byEmail = new Map<string, AnswerData>();
  const byRowIndex = new Map<number, AnswerData>();

  for (const row of filtered) {
    const timestampMs = Number(row.__timestampMs);
    // determine email key
    let normalizedEmail: string | null = null;
    if (emailHeader) {
      normalizedEmail = normalizeEmail(String(row[emailHeader] ?? ""));
    } else {
      // if no email header found, leave normalizedEmail null
      normalizedEmail = null;
    }

    if (excludeMissingEmail && !normalizedEmail) {
      continue; // skip
    }

    if (uniqueByEmail && normalizedEmail) {
      const prev = byEmail.get(normalizedEmail);
      if (!prev) {
        byEmail.set(normalizedEmail, row);
      } else {
        const prevTs = Number(prev.__timestampMs ?? 0);
        if (timestampMs >= prevTs) {
          // "最後の回答時間が結果" のポリシーに基づき上書き
          byEmail.set(normalizedEmail, row);
        }
      }
    } else {
      // use row index as unique key
      byRowIndex.set(Number(row.__rowIndex), row);
    }
  }

  // Collect results
  let list: AnswerData[] = [];
  if (uniqueByEmail) {
    list = Array.from(byEmail.values());
  } else {
    list = Array.from(byRowIndex.values());
  }

  // Sort by __timestampMs ascending (早い順)
  list.sort((a, b) => {
    const ta = Number(a.__timestampMs ?? 0);
    const tb = Number(b.__timestampMs ?? 0);
    if (ta < tb) return -1;
    if (ta > tb) return 1;
    return 0;
  });

  // pick top limit
  let top = list.slice(0, limit);

  // Add timeToAnswerSec (seconds from quizStartTimeMs) and display-friendly field
  top = top.map((item) => {
    const ts = Number(item.__timestampMs ?? 0);
    const deltaMs = ts - quizStartTimeMs;
    const secs = Number.isFinite(deltaMs) ? deltaMs / 1000 : NaN;
    const timeToAnswerSec = Number.isFinite(secs) ? Number(secs) : null;
    const copy: AnswerData = { ...item };
    // attach display-friendly field
    (copy as any).__timeToAnswerSec = timeToAnswerSec;
    (copy as any).__timeToAnswer =
      timeToAnswerSec === null ? null : toSecondsString(timeToAnswerSec);
    return copy;
  });

  // If not enough, append placeholders
  while (top.length < limit) {
    const placeholder: AnswerData = {
      __rowIndex: -1,
      __raw: [] as RawRow,
      name: "正答者なし ---",
      __timestampMs: null,
      __isPlaceholder: true,
      __timeToAnswerSec: null,
      __timeToAnswer: null,
    } as AnswerData;
    top.push(placeholder);
  }

  return top;
}
