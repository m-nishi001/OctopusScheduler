import type { Result } from "../result/result";

export interface History {
  id: string;
  drawName: string;
  result: Result;
  savedAt: string;
}
