import { Prize } from "../../domain/entities/prize";

export interface IPrizeRepository {
  findAll(): Promise<Prize[]>;
  findById(id: string): Promise<Prize | null>;
  save(prize: Prize): Promise<void>;
  delete(id: string): Promise<void>;
}
