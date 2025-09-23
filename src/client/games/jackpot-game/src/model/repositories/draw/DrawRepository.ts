import type { Draw } from '../../domains/draw/Draw';
import type { DrawRequest } from '../../applications/DrawRequest';
import type { DrawResponse } from '../../applications/DrawResponse';

export interface DrawRepository {
  executeDraw(request: DrawRequest): Promise<DrawResponse>;
  getDrawById(id: string): Promise<Draw | null>;
  getAllDraws(): Promise<Draw[]>;
}
