
import { IMemberRepository } from "../../domain/repositories/member-repository";
import { Member } from "../../domain/entities/member";
import { ISpreadsheetService, SpreadsheetService } from "../../../../../shared-packages/src/google-spreadsheet-service";

export class MemberRepository implements IMemberRepository {
  private readonly repository: ISpreadsheetService<Member>;
  private readonly sheetName = "Members";

  constructor() {
    this.repository = SpreadsheetService.getService<Member>(this.sheetName);
  }

  async findAll(): Promise<Member[]> {
    return this.repository.find((m: Member) => true);
  }

  async findById(id: string): Promise<Member | null> {
    return this.repository.find((m: Member) => m.id === id)[0] || null;
  }

  async save(member: Member): Promise<void> {
    this.repository.add(member);
  }

  async delete(id: string): Promise<void> {
    this.repository.delete((m: Member) => m.id === id);
  }
}
