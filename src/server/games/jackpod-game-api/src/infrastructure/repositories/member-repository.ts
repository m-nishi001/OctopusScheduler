
import { injectable } from "tsyringe";
import { IMemberRepository } from "../../domain/repositories/member-repository";
import { Member } from "../../domain/entities/member";
import { ISpreadsheetService, SpreadsheetService } from "../../../../../shared-packages/src/google-spreadsheet-service";

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

    save(member: Member): void {
        this.repository.add(member);
    }

    update(id: string, updateEntity: (member: Member) => Member): number {
        return this.repository.update((m: Member) => m.id === id, updateEntity);
    }

    updateMany(ids: string[], updateEntity: (member: Member) => Member): number {
        return this.repository.update((m: Member) => ids.includes(m.id), updateEntity);
    }

    delete(id: string): void {
        this.repository.delete((m: Member) => m.id === id);
    }

    deleteMany(ids: string[]): void {
        this.repository.delete((m: Member) => ids.includes(m.id));
    }
}
