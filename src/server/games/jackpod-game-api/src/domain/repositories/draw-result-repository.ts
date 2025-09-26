import { DrawResult } from "../../domain/entities/draw-result";

export interface IDrawResultRepository {
  findAll(): Promise<DrawResult[]>;
  findById(drawId: string): Promise<DrawResult | null>;
  save(result: DrawResult): Promise<void>;
}
