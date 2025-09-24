import { AdminRepository } from '../infrastructures/repository/admin-repository';

export class AdminService {
    private readonly repo = new AdminRepository();
    async updateSettings(settings: object): Promise<void> {
        await this.repo.updateSettings(settings);
    }
}
