import { inject, injectable } from "tsyringe";
import { IAccountsApiToken } from "../../server/accounts-api-contract";
import type { LoginResult, Member, AccountsApi, RosterUsage } from "../../server/accounts-api-contract";

/** アカウント・名簿の API(ログイン・ログアウト・メンバーの一覧と変更・ログインキーの発行)への窓口。 */
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

  async addMember(args: { id?: string; name: string; isAdmin?: boolean; photo?: string }): Promise<Member> {
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

  /** 顔写真を保存する(管理者のみ)。同じハッシュなら上書きなので、送り直しても安全。 */
  async putMemberPhoto(hash: string, dataUrl: string): Promise<void> {
    await this.accountsApi.putMemberPhoto({ hash, dataUrl });
  }

  /** 渡したハッシュのうち、サーバーに保存済みのもの(管理者のみ)。 */
  async existsMemberPhotos(hashes: string[]): Promise<string[]> {
    return (await this.accountsApi.existsMemberPhotos({ hashes })).existing;
  }

  /** 写真の中身(ハッシュ → データURL)。最大10枚まで。キャッシュ越しに使うので、画面から直接は呼ばない。 */
  async getMemberPhotos(hashes: string[]): Promise<Record<string, string>> {
    return (await this.accountsApi.getMemberPhotos({ hashes })).photos;
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
