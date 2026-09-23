import type {
  ICache,
  IKeyValueStorage,
  DataBaseFactory,
} from "@octopus/infrastructures/interfaces";
import { getMappedResponses } from "./get-mapped-responses-use-case";
import type { ProcessedResultDto, StopAndGetProcessedResultsArgs } from "./quiz-api-contract";

export interface StopAndGetProcessedResultsDeps {
  form: {
    stopAcceptingResponses(formId: string): void;
    getDestinationRecordStoreId(formId: string): string | null;
  };
  dataBaseFactory: DataBaseFactory;
  cache: ICache;
  storage: IKeyValueStorage;
}

/**
 * quizGame_stopAndGetProcessedResults。フォーム停止 -> 回答取得 -> 正答/有効タイムスタンプで
 * フィルタ -> 昇順ソート -> 順位付け、という流れ。フォーム停止は quizGame_stopForm と
 * 同じ Form 呼び出しに統合している(挙動は同一)。回答取得も JSON文字列の
 * ラウンドトリップを廃し、通常の関数呼び出しにしている。
 */
export function stopAndGetProcessedResults(
  deps: StopAndGetProcessedResultsDeps,
  args: StopAndGetProcessedResultsArgs
): ProcessedResultDto[] {
  const { quizId, quizStartTimeMs, answerKey, correctValue } = args;

  deps.form.stopAcceptingResponses(quizId);

  const answers = getMappedResponses(deps, quizId);

  const filtered = answers.filter((r) => {
    const record = r as Record<string, unknown>;
    const normVal = String(record[answerKey] ?? "").trim();
    if (normVal !== correctValue) return false;
    const t = record.__timestampMs;
    if (t === undefined || t === null || Number.isNaN(Number(t))) return false;
    return true;
  });

  filtered.sort(
    (a, b) =>
      Number((a as Record<string, unknown>).__timestampMs ?? 0) -
      Number((b as Record<string, unknown>).__timestampMs ?? 0)
  );

  return filtered.map((r, index) => {
    const record = r as Record<string, unknown>;
    const rawTs = Number(record.__timestampMs);
    const timestampMs = Number.isFinite(rawTs) ? rawTs : NaN;
    const timeToAnswerMs = Number.isFinite(timestampMs)
      ? timestampMs - quizStartTimeMs
      : NaN;
    return {
      playerId: null,
      playerName: (record.name as string) || null,
      isCorrect: true,
      timeToAnswerMs,
      timestampMs,
      rank: index + 1,
      rawRow: record.__raw as unknown[],
    } as ProcessedResultDto;
  });
}
