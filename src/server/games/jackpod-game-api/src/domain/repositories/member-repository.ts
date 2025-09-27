import { Member } from "../../domain/entities/member";

export interface IMemberRepository {
    findAll(): Promise<Member[]>;
    findById(id: string): Promise<Member | null>;
    findManyByIds(ids: string[]): Promise<Member[]>;
    save(member: Member): Promise<void>;
    update(id: string, updateEntity: (member: Member) => Member): Promise<number>;
    updateMany(ids: string[], updateEntity: (member: Member) => Member): Promise<number>;
    delete(id: string): Promise<void>;
    deleteMany(ids: string[]): Promise<void>;
}
