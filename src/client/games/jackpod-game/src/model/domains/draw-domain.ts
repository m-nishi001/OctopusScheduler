import { GasFunctionService } from '../../../../../packages/common-lib/src/google-apps-script/gas-script-service';
import type { DrawRequest } from '../applications/DrawRequest';
import type { DrawResponse } from '../applications/DrawResponse';
import type { ResultResponse } from '../applications/ResultResponse';
import type { User } from './user/User';

export class DrawDomain {
  private gasService: GasFunctionService | null;
  constructor() {
    this.gasService = GasFunctionService.create('drawApi');
  }

  async executeDraw(request: DrawRequest): Promise<DrawResponse> {
    if (!this.gasService) throw new Error('GasFunctionService生成失敗');
    const func = this.gasService.createCall<DrawResponse>('executeDraw', request);
    const result = await func.invoke();
    // TODO: result型に応じて成功/失敗判定
    return (result as any).data as DrawResponse;
  }

  async getResult(drawId: string): Promise<ResultResponse> {
    if (!this.gasService) throw new Error('GasFunctionService生成失敗');
    const func = this.gasService.createCall<ResultResponse>('getResult', { drawId });
    const result = await func.invoke();
    return (result as any).data as ResultResponse;
  }

  async getCandidates(): Promise<User[]> {
    if (!this.gasService) throw new Error('GasFunctionService生成失敗');
    const func = this.gasService.createCall<User[]>('getCandidates', {});
    const result = await func.invoke();
    return (result as any).data as User[];
  }
}
