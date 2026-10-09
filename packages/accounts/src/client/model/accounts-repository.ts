import { inject, injectable } from "tsyringe";
import { IAccountsApiToken } from "../../server/accounts-api-contract";
import type { LoginResult, Member, AccountsApi } from "../../server/accounts-api-contract";

@injectable()
export class AccountsRepository {
  constructor(
    @inject(IAccountsApiToken) private readonly accountsApi: AccountsApi
  ) {}

  async listMembers(): Promise<Member[]> {
    return this.accountsApi.listMembers({});
  }

  async listAccounts(): Promise<Member[]> {
    return this.accountsApi.listAccounts({});
  }

  async addMember(args: { id?: string; name: string; isAdmin?: boolean }): Promise<Member> {
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

  async setPassword(id: string, password: string): Promise<void> {
    return this.accountsApi.setPassword({ id, password });
  }

  async login(id: string, password: string): Promise<LoginResult> {
    return this.accountsApi.login({ id, password });
  }

  async logout(token: string): Promise<void> {
    return this.accountsApi.logout({ token });
  }

  async getSession(token: string): Promise<Member | null> {
    return this.accountsApi.getSession({ token });
  }
}
