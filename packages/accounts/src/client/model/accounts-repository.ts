import { inject, injectable } from "tsyringe";
import { IAccountsApiToken } from "../../server/accounts-api-contract";
import type { Member, AccountsApi } from "../../server/accounts-api-contract";

@injectable()
export class AccountsRepository {
  constructor(
    @inject(IAccountsApiToken) private readonly accountsApi: AccountsApi
  ) {}

  async listMembers(): Promise<Member[]> {
    return this.accountsApi.listMembers({});
  }

  async addMember(args: { id?: string; name: string }): Promise<Member> {
    return this.accountsApi.addMember(args);
  }

  async updateMember(member: Member): Promise<Member> {
    return this.accountsApi.updateMember(member);
  }

  async deleteMember(id: string): Promise<void> {
    return this.accountsApi.deleteMember({ id });
  }

  async replaceAllMembers(members: Member[]): Promise<{ replaced: number }> {
    return this.accountsApi.replaceAllMembers({ members });
  }
}
