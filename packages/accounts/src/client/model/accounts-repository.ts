import { inject, injectable } from "tsyringe";
import { IAccountsApiToken } from "../../server/accounts-api-contract";
import type { LoginResult, Member, AccountsApi, RosterUsage } from "../../server/accounts-api-contract";

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

  /** 名簿の容量の使用状況(上限に近づいたら警告するため)。 */
  async getRosterUsage(): Promise<RosterUsage> {
    return this.accountsApi.getRosterUsage({});
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

  /** 参加者の受付QR用ログインキーを(再)発行する。平文は戻り値でしか見られない。 */
  async issueLoginKey(id: string): Promise<string> {
    return (await this.accountsApi.issueLoginKey({ id })).key;
  }

  async revokeLoginKey(id: string): Promise<void> {
    return this.accountsApi.revokeLoginKey({ id });
  }

  async loginWithKey(id: string, key: string): Promise<LoginResult> {
    return this.accountsApi.loginWithKey({ id, key });
  }

  async logout(token: string): Promise<void> {
    return this.accountsApi.logout({ token });
  }

  async getSession(token: string): Promise<Member | null> {
    return this.accountsApi.getSession({ token });
  }
}
