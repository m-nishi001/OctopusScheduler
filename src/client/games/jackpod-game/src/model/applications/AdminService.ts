import { adminApi } from '../infrastructures/api/adminApi';

export class AdminService {
  async updateSettings(settings: object): Promise<void> {
    await adminApi.updateSettings(settings);
  }
}
