import { DrawRepository } from '../infrastructures/repository/draw-repository';
import type { DrawRequest } from './dto/draw-request';
import type { DrawResponse } from './dto/draw-response';

export class LotteryService {
  private readonly repo = new DrawRepository();

  async executeDraw(request: DrawRequest): Promise<DrawResponse> {
    return await this.repo.executeDraw(request);
  }
}
