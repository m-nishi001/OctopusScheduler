export class StorageConfig {
  static getDbName() {
    return "octopus-scheduler";
  }

  static getStoreName(storeKey: string = "default"): string {
    return storeKey;
  }
}
