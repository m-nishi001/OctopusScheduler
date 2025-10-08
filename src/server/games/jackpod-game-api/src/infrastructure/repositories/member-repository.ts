import { injectable } from "tsyringe";
import { IMemberRepository } from "../../domain/repositories/member-repository";
import { Member } from "../../domain/entities/member";
import {
  ISpreadsheetService,
  SpreadsheetService,
} from "../../../../../shared-packages/src/google-spreadsheet-service";

@injectable()
export class MemberRepository implements IMemberRepository {
  private readonly repository: ISpreadsheetService<Member>;
  private readonly sheetName = "Members";

  constructor() {
    this.repository = SpreadsheetService.getService<Member>(this.sheetName);
  }

  findAll(): Member[] {
    return this.repository.find((m: Member) => true);
  }

  findById(id: string): Member | null {
    return this.repository.find((m: Member) => m.id === id)[0] || null;
  }

  findManyByIds(ids: string[]): Member[] {
    return this.repository.find((m: Member) => ids.includes(m.id));
  }

  batchOperations(operations: {
    add: Member[];
    update: { id: string; updateFn: (member: Member) => Member }[];
    delete: string[];
  }): void {
    const transaction = this.repository.beginTransaction();
    transaction.addMany(operations.add);
    for (const updateOp of operations.update) {
      transaction.updateMany([updateOp.id], updateOp.updateFn);
    }
    transaction.deleteMany(operations.delete);
    transaction.commit();
  }
}
