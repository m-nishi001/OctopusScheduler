import type { ResultResponse } from '../../applications/ResultResponse';

export const resultApi = {
  async getResult(drawId: string): Promise<ResultResponse> {
    // TODO: 実際のAPIエンドポイントに合わせて修正
    const response = await fetch(`/api/result/${drawId}`);
    if (!response.ok) throw new Error('結果API通信エラー');
    return await response.json();
  },
};
