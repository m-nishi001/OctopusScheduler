import { injectable, inject } from 'tsyringe';
import type { IDrawRepository } from '../domains/draw/repository/IDrawRepository';
import type { DrawRequest } from './dto/draw-request';
import type { DrawResponse } from './dto/draw-response';

@injectable()
export class LotteryService {
  constructor(@inject("IDrawRepository") private repo: IDrawRepository) {}

  async executeDraw(request: DrawRequest): Promise<DrawResponse> {
    return await this.repo.executeDraw(request);
  }
}
