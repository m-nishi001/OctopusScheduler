import { injectable } from "tsyringe";
import { IMemberRepository } from "../../domain/member/member-repository";
import { Member } from "../../domain/member/member";
import {
  ISpreadsheetService,
  SpreadsheetService,
} from "../../../../../shared-packages/src/google-spreadsheet-service";

@injectable()
export class MemberRepository implements IMemberRepository {
  private readonly repository: ISpreadsheetService<Member>;
  private readonly sheetName = "Members";

  constructor() {
    this.repository = SpreadsheetService.getService<Member>(
      this.sheetName,
      "jackpot-game-api-spreadsheet"
    );
  }

  getMembers(): Member[] {
    return this.repository.find(() => true);
  }

  getMemberById(id: string): Member | null {
    return this.repository.find((m: Member) => m.id === id)[0] || null;
  }

  addMembers(members: Member[]): string[] {
    const membersWithId = members.map((member) => ({
      ...member,
      id: member.id || Utilities.getUuid(),
    }));
    const transaction = this.repository.beginTransaction();
    transaction.addMany(membersWithId);
    transaction.commit();
    return membersWithId.map((m) => m.id);
  }

  updateMembers(
    updates: { id: string; updateFn: (member: Member) => Member }[]
  ): void {
    const transaction = this.repository.beginTransaction();
    for (const update of updates) {
      transaction.updateMany([update.id], update.updateFn);
    }
    transaction.commit();
  }

  deleteMembers(ids: string[]): void {
    const transaction = this.repository.beginTransaction();
    transaction.deleteMany(ids);
    transaction.commit();
  }
}
