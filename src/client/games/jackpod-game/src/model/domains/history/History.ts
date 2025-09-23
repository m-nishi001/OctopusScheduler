import type { Result } from "../result/Result";

export interface History {
  id: string;
  drawName: string;
  result: Result;
  savedAt: string;
}
