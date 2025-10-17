import { injectable } from "tsyringe";
import type { DrawRequest } from "../../applications/draw/dto/draw-request";
import type { DrawResponse } from "../../applications/draw/dto/draw-response";

@injectable()
export class DrawRepository {
  async executeDraw(_request: DrawRequest): Promise<DrawResponse> {
    throw new Error("GAS service not available");
  }
}
