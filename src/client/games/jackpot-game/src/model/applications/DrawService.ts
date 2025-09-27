import type { DrawRequest } from './dto/DrawRequest';
import type { DrawResponse } from './dto/DrawResponse';
import { DrawRepository } from '../infrastructures/repository/draw-repository';

export class DrawService {
    private readonly repo = new DrawRepository();
    async executeDraw(request: DrawRequest): Promise<DrawResponse> {
        return await this.repo.executeDraw(request);
    }
}
