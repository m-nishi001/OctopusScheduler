import { DrawResult } from "../../domain/entities/draw-result";

export interface IDrawResultRepository {
  findAll(): Promise<DrawResult[]>;
  findById(drawId: string): Promise<DrawResult | null>;
  findManyByIds(ids: string[]): Promise<DrawResult[]>;
  save(result: DrawResult): Promise<void>;
  update(drawId: string, updateEntity: (result: DrawResult) => DrawResult): Promise<number>;
  updateMany(ids: string[], updateEntity: (result: DrawResult) => DrawResult): Promise<number>;
  delete(drawId: string): Promise<void>;
  deleteMany(ids: string[]): Promise<void>;
}
