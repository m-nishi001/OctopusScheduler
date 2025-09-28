import { DrawResult } from "../../domain/entities/draw-result";

export interface IDrawResultRepository {
  findAll(): DrawResult[];
  findById(drawId: string): DrawResult | null;
  findManyByIds(ids: string[]): DrawResult[];
  save(result: DrawResult): void;
  update(drawId: string, updateEntity: (result: DrawResult) => DrawResult): number;
  updateMany(ids: string[], updateEntity: (result: DrawResult) => DrawResult): number;
  delete(drawId: string): void;
  deleteMany(ids: string[]): void;
}
