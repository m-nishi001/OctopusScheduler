import { injectable, inject } from 'tsyringe';
import type { IAdminRepository } from '../domains/admin/repository/IAdminRepository';

@injectable()
export class AdminService {
    constructor(@inject("IAdminRepository") private repo: IAdminRepository) {}
    async updateSettings(settings: object): Promise<void> {
        await this.repo.updateSettings(settings);
    }
}
