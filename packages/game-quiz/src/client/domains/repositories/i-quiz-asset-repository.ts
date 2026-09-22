export const IQuizAssetRepositoryToken = Symbol("IQuizAssetRepository");

export interface IQuizAssetRepository {
  saveAsset(blob: Blob): Promise<string>;
  getAsset(id: string): Promise<Blob | null>;
  deleteAsset(id: string): Promise<void>;
  getAllAssets(): Promise<Map<string, Blob>>;
}
