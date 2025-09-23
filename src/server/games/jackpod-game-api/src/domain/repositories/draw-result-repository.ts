import { DrawResult } from "../../domain/entities/draw-result";

export interface IDrawResultRepository {
  findAll(): Promise<DrawResult[]>;
  save(result: DrawResult): Promise<void>;
}
