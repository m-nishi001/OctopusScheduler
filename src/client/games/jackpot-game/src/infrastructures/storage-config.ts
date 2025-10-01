export class StorageConfig {
  static getDbName(): string {
    return "jackpot-game";
  }

  // storeKey を渡すとそのまま storeName として返す。将来マッピングが必要ならここで一元管理する。
  static getStoreName(storeKey: string = "default"): string {
    return storeKey;
  }
}
