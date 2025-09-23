import type { History } from '../../domains/history/History';

export const historyApi = {
  async getHistory(): Promise<History[]> {
    // TODO: 実際のAPIエンドポイントに合わせて修正
    const response = await fetch('/api/history');
    if (!response.ok) throw new Error('履歴API通信エラー');
    return await response.json();
  },
};
