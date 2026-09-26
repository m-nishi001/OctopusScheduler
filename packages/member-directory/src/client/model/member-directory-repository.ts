import { inject, injectable } from "tsyringe";
import { IMemberDirectoryApiToken } from "../../server/member-directory-api-contract";
import type { Member, MemberDirectoryApi } from "../../server/member-directory-api-contract";

@injectable()
export class MemberDirectoryRepository {
  constructor(
    @inject(IMemberDirectoryApiToken) private readonly memberDirectoryApi: MemberDirectoryApi
  ) {}

  async listMembers(): Promise<Member[]> {
    return this.memberDirectoryApi.listMembers({});
  }

  async addMember(args: { id?: string; name: string }): Promise<Member> {
    return this.memberDirectoryApi.addMember(args);
  }

  async updateMember(member: Member): Promise<Member> {
    return this.memberDirectoryApi.updateMember(member);
  }

  async deleteMember(id: string): Promise<void> {
    return this.memberDirectoryApi.deleteMember({ id });
  }

  async replaceAllMembers(members: Member[]): Promise<{ replaced: number }> {
    return this.memberDirectoryApi.replaceAllMembers({ members });
  }
}
