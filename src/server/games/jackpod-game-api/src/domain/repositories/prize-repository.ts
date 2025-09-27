import { Prize } from "../../domain/entities/prize";

export interface IPrizeRepository {
  findAll(): Promise<Prize[]>;
  findById(id: string): Promise<Prize | null>;
  findManyByIds(ids: string[]): Promise<Prize[]>;
  save(prize: Prize): Promise<void>;
  update(id: string, updateEntity: (prize: Prize) => Prize): Promise<number>;
  updateMany(ids: string[], updateEntity: (prize: Prize) => Prize): Promise<number>;
  delete(id: string): Promise<void>;
  deleteMany(ids: string[]): Promise<void>;
}
