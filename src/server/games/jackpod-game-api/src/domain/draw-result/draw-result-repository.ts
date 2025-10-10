import { DrawResult } from "../../domain/entities/draw-result";

export interface IDrawResultRepository {
  getDrawResults(): DrawResult[];
  getDrawResultById(drawId: string): DrawResult | null;
  updateDrawResults(results: DrawResult[]): void;
  deleteDrawResults(drawIds: string[]): void;
  addDrawResults(results: DrawResult[]): void;
}
