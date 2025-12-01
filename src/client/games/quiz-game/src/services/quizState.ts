let quizStartTimeMs: number | null = null;
let cachedResults: any[] | null = null;

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
  // Results cache API
  setResults(results: any[] | null) {
    cachedResults = Array.isArray(results) ? results : null;
  },
  getResults(): any[] | null {
    return cachedResults;
  },
  clearResults() {
    cachedResults = null;
  },
};

export default quizState;
