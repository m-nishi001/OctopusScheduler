import { injectable, inject } from "tsyringe";
import type { QuizWithDataUrl } from "quiz-game-api";
import { QuizResultService } from "../../services/quiz-result-service";
import { computeTopResponders } from "../../../services/resultProcessor";
import { normalizeAnswer } from "../../../types/quiz";

@injectable()
export class GetQuizResultsUseCase {
  constructor(@inject(QuizResultService) private svc: QuizResultService) {}

  private buildPreviewMappedResponses(quiz: any, quizStartMs: number) {
    const optionText =
      quiz?.options?.find((o: any) => o.no === quiz?.correctNo)?.text ??
      String(quiz?.correctNo ?? "");
    const base = Number(quizStartMs ?? Date.now());
    return [
      {
        回答: optionText,
        メールアドレス: "tanaka@example.com",
        __timestampMs: base + 5000,
        __rowIndex: 2,
        __raw: [],
        name: "田中 仁",
      },
      {
        回答: optionText,
        メールアドレス: "suzuki@example.com",
        __timestampMs: base + 12000,
        __rowIndex: 3,
        __raw: [],
        name: "鈴木 太郎",
      },
      {
        回答: optionText,
        メールアドレス: "sato@example.com",
        __timestampMs: base + 18000,
        __rowIndex: 4,
        __raw: [],
        name: "佐藤 花子",
      },
      {
        回答: optionText,
        メールアドレス: "takahashi@example.com",
        __timestampMs: base + 22000,
        __rowIndex: 5,
        __raw: [],
        name: "高橋 一郎",
      },
      {
        回答: optionText,
        メールアドレス: "inoue@example.com",
        __timestampMs: base + 26000,
        __rowIndex: 6,
        __raw: [],
        name: "井上 美咲",
      },
      {
        回答: optionText,
        メールアドレス: "yamamoto@example.com",
        __timestampMs: base + 30000,
        __rowIndex: 7,
        __raw: [],
        name: "山本 秀樹",
      },
      {
        回答: optionText,
        メールアドレス: "nakamura@example.com",
        __timestampMs: base + 34000,
        __rowIndex: 8,
        __raw: [],
        name: "中村 翼",
      },
      {
        回答: optionText,
        メールアドレス: "kobayashi@example.com",
        __timestampMs: base + 38000,
        __rowIndex: 9,
        __raw: [],
        name: "小林 真理",
      },
      {
        回答: optionText,
        メールアドレス: "kimura@example.com",
        __timestampMs: base + 42000,
        __rowIndex: 10,
        __raw: [],
        name: "木村 健",
      },
    ];
  }

  async execute(
    quiz: QuizWithDataUrl,
    quizStartMs: number,
    isPreview: boolean
  ) {
    const quizStart = quizStartMs ?? Date.now();
    let mapped: any[] = [];

    if (isPreview) {
      mapped = this.buildPreviewMappedResponses(quiz, quizStart);
    } else {
      const formId = quiz?.answerFormId;
      if (!formId) return [];
      mapped = await this.svc.getMappedResponses(formId);
    }

    // determine answerKey and correctValue heuristically (same logic as UI used previously)
    let answerKey = "";
    let correctValue = String(quiz?.correctNo ?? "");
    const optionText = quiz?.options?.find(
      (o: any) => o.no === quiz?.correctNo
    )?.text;

    if (Array.isArray(mapped) && mapped.length > 0) {
      const sample = mapped[0];
      const candidateHeaders = Object.keys(sample).filter(
        (h) =>
          !h.startsWith("__") &&
          !/タイムスタンプ|timestamp|メール|email/i.test(h)
      );
      let bestHeader = candidateHeaders[0] || Object.keys(sample)[0];
      let bestScore = -1;
      for (const h of candidateHeaders) {
        let score = 0;
        for (const r of mapped) {
          const v = (r[h] ?? "") + "";
          if (optionText && String(v) === String(optionText)) score++;
          if (
            quiz?.correctNo !== undefined &&
            String(v) === String(quiz.correctNo)
          )
            score++;
        }
        if (score > bestScore) {
          bestScore = score;
          bestHeader = h;
        }
      }
      answerKey = bestHeader;
      if (bestScore > 0) {
        correctValue = optionText
          ? String(optionText)
          : String(quiz?.correctNo ?? "");
      } else {
        answerKey =
          candidateHeaders[0] ||
          Object.keys(sample).find((k) => !k.startsWith("__")) ||
          Object.keys(sample)[0];
        correctValue = optionText
          ? String(optionText)
          : String(quiz?.correctNo ?? "");
      }
    } else {
      return [];
    }

    const normalizedCorrect = normalizeAnswer(correctValue);

    const top = computeTopResponders(mapped, {
      answerKey,
      correctValue: normalizedCorrect,
      limit: 10,
      uniqueByEmail: true,
      excludeMissingEmail: true,
      quizStartTimeMs: quizStart,
    });

    const final = top.map((item) => {
      const secs = (item as any).__timeToAnswerSec;
      const timeSeconds =
        typeof secs === "number" && !Number.isNaN(secs) ? secs : null;
      return { name: item.name ?? "正答者なし ---", timeSeconds };
    });

    return final;
  }
}
