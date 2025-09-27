import type { ScreenConfig } from '../../model/domains/screen-config/ScreenConfig';

export class ScreenConfigService {
  // 仮実装: API/IndexedDBから取得する想定
  async fetchScreenConfig(screenType: string): Promise<ScreenConfig> {
    // TODO: API/IndexedDB連携
    // ここでは設計書に準拠したダミーデータを返す
    if (screenType === 'opening') {
      return {
        type: 'opening',
        bgmAssetId: 'asset_bgm_opening',
        seAssetIds: ['asset_se_scroll', 'asset_se_fade'],
        backgroundStyle: 'linear-gradient(to right, #a5b4fc, #f9a8d4)',
        elements: [
          { id: 'title1', type: 'text', content: 'ジャックポッド大会へようこそ！', animation: { type: 'scroll', duration: 1.2 } },
          { id: 'title2', type: 'text', content: '豪華賞品が当たる抽選イベント', animation: { type: 'scroll', duration: 1.2 } },
          { id: 'img1', type: 'image', assetId: '/assets/img/opening1.png', animation: { type: 'fade', duration: 1.0 } },
          { id: 'title3', type: 'text', content: 'スタートまでお待ちください', animation: { type: 'scroll', duration: 1.2 } }
        ],
        animationSettings: {
          type: 'scroll',
          duration: 2.0,
          params: { direction: 'up' }
        }
      };
    }
    // 他画面は適宜追加
    throw new Error('ScreenConfig not found');
  }
}
