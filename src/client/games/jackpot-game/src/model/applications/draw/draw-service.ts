import type { DrawRequest } from "./dto/draw-request";
import type { DrawResponse } from "./dto/draw-response";
import { injectable } from "tsyringe";
import { DrawService as DomainDrawService } from "../../domains/draw/draw-service";

@injectable()
export class DrawService {
  async executeDraw(request: DrawRequest): Promise<DrawResponse> {
    const domainService = new DomainDrawService();
    const input = {
      members: request.members.map((m) => ({ id: m.id, weight: 1 })),
      prizes: request.prizes.map((p) => ({ id: p.id, weight: p.probability })),
      variable: 1,
    };
    const pairs = domainService.draw(input);
    return { drawId: "draw-" + Date.now(), status: "completed", pairs };
  }
}
