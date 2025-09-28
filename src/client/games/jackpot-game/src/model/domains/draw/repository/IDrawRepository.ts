import type { DrawRequest } from '../../../applications/dto/draw-request';
import type { DrawResponse } from '../../../applications/dto/draw-response';

export interface IDrawRepository {
  executeDraw(request: DrawRequest): Promise<DrawResponse>;
}
