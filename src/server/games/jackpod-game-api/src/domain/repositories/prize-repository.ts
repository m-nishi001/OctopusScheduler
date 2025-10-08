import { Prize } from "../../domain/entities/prize";

export interface IPrizeRepository {
  findAll(): Prize[];
  findById(id: string): Prize | null;
  findManyByIds(ids: string[]): Prize[];
  batchOperations(
    adds: Prize[],
    updates: { ids: string[]; updateFn: (prize: Prize) => Prize }[],
    deletes: string[]
  ): void;
}
