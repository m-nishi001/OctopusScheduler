import type { DrawRequest } from './DrawRequest';
import type { DrawResponse } from './DrawResponse';
import { drawApi } from '../infrastructures/api/drawApi';

export class DrawService {
  async executeDraw(request: DrawRequest): Promise<DrawResponse> {
    return await drawApi.executeDraw(request);
  }
}
