import { DrawResult } from "./draw-result";

export interface IDrawResultRepository {
  getDrawResults(): Promise<DrawResult[]>;
  getDrawResultById(drawId: string): Promise<DrawResult | null>;
  updateDrawResults(results: DrawResult[]): Promise<void>;
  deleteDrawResults(drawIds: string[]): Promise<void>;
  addDrawResults(results: DrawResult[]): Promise<void>;
}
