import type { DrawRequest } from '../../applications/DrawRequest';
import type { DrawResponse } from '../../applications/DrawResponse';

export const drawApi = {
  async executeDraw(request: DrawRequest): Promise<DrawResponse> {
    // TODO: 実際のAPIエンドポイントに合わせて修正
    const response = await fetch('/api/draw', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(request),
    });
    if (!response.ok) throw new Error('抽選API通信エラー');
    return await response.json();
  },
};
