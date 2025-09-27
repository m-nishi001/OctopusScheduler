
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


    async findAll(): Promise<Member[]> {
        return this.repository.find((m: Member) => true);
    }

    async findById(id: string): Promise<Member | null> {
        return this.repository.find((m: Member) => m.id === id)[0] || null;
    }

    async findManyByIds(ids: string[]): Promise<Member[]> {
        return this.repository.find((m: Member) => ids.includes(m.id));
    }

    async save(member: Member): Promise<void> {
        this.repository.add(member);
    }

    async update(id: string, updateEntity: (member: Member) => Member): Promise<number> {
        return this.repository.update((m: Member) => m.id === id, updateEntity);
    }

    async updateMany(ids: string[], updateEntity: (member: Member) => Member): Promise<number> {
        return this.repository.update((m: Member) => ids.includes(m.id), updateEntity);
    }

    async delete(id: string): Promise<void> {
        this.repository.delete((m: Member) => m.id === id);
    }

    async deleteMany(ids: string[]): Promise<void> {
        this.repository.delete((m: Member) => ids.includes(m.id));
    }
}
