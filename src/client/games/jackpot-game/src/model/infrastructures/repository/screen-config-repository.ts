import type { ScreenConfig } from '../../domains/screen-config/screen-config';

export class ScreenConfigRepository {
  private cache: Map<string, ScreenConfig> = new Map();

  // 画面設定を取得
  async fetchScreenConfig(type: string): Promise<ScreenConfig | undefined> {
    return this.cache.get(type);
  }

  // 差分更新保存
  async saveScreenConfigs(newConfigs: ScreenConfig[]): Promise<void> {
    for (const config of newConfigs) {
      const prev = this.cache.get(config.type);
      if (!prev || JSON.stringify(prev) !== JSON.stringify(config)) {
        // 差分があれば保存（ここでは仮にlocalStorage保存）
        localStorage.setItem('screen_' + config.type, JSON.stringify(config));
        this.cache.set(config.type, config);
      }
    }
  }

  // 初期化（localStorageからロード）
  async loadAllFromStorage(types: string[]): Promise<void> {
    for (const type of types) {
      const raw = localStorage.getItem('screen_' + type);
      if (raw) {
        this.cache.set(type, JSON.parse(raw));
      }
    }
  }
}
