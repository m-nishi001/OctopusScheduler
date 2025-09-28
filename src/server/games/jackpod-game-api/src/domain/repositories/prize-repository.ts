import { Prize } from "../../domain/entities/prize";

export interface IPrizeRepository {
  findAll(): Prize[];
  findById(id: string): Prize | null;
  findManyByIds(ids: string[]): Prize[];
  save(prize: Prize): void;
  update(id: string, updateEntity: (prize: Prize) => Prize): number;
  updateMany(ids: string[], updateEntity: (prize: Prize) => Prize): number;
  delete(id: string): void;
  deleteMany(ids: string[]): void;
}
