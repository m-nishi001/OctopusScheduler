export const adminApi = {
  async updateSettings(settings: object): Promise<void> {
    // TODO: 実際のAPIエンドポイントに合わせて修正
    await fetch('/api/admin/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(settings),
    });
  },
};
