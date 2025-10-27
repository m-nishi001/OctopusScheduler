import type { DrawResultDto } from "applications/draw/dto/draw-result-dto";

// Runtime DI token for IDrawResultRepository
export const IDrawResultRepositoryToken = Symbol("IDrawResultRepository");

export interface IDrawResultRepository {
  getDrawResults(): Promise<DrawResultDto[]>;
  getDrawResultById(drawId: string): Promise<DrawResultDto | null>;
  addDrawResult(result: DrawResultDto): Promise<void>;
  updateDrawResult(result: DrawResultDto): Promise<void>;
  deleteDrawResult(resultId: string): Promise<void>;
  syncDrawResults(): Promise<{ synced: number }>;
}
