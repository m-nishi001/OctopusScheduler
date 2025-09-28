export interface IAdminRepository {
  updateSettings(settings: object): Promise<void>;
}
