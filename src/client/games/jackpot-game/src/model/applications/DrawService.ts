import type { DrawRequest } from './DrawRequest';
import type { DrawResponse } from './DrawResponse';
import { DrawRepository } from '../infrastructures/repository/draw-repository';

export class DrawService {
    private readonly repo = new DrawRepository();
    async executeDraw(request: DrawRequest): Promise<DrawResponse> {
        return await this.repo.executeDraw(request);
    }
}
