import type { ResultResponse } from "../../../applications/result/dto/result-response";

export interface IResultRepository {
  getResult(drawId: string): Promise<ResultResponse | null>;
}
