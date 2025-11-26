let quizStartTimeMs: number | null = null;

export const quizState = {
  setStartTime(nowMs?: number) {
    quizStartTimeMs = typeof nowMs === "number" ? nowMs : Date.now();
  },
  getStartTime(): number | null {
    return quizStartTimeMs;
  },
  clear() {
    quizStartTimeMs = null;
  },
};

export default quizState;
