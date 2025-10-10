import type { DrawRequest } from "../../../applications/draw/dto/draw-request";
import type { DrawResponse } from "../../../applications/draw/dto/draw-response";

export interface IDrawRepository {
  executeDraw(request: DrawRequest): Promise<DrawResponse>;
}
