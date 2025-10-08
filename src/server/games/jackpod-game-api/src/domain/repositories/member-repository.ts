import { Member } from "../../domain/entities/member";

export interface IMemberRepository {
  findAll(): Member[];
  findById(id: string): Member | null;
  findManyByIds(ids: string[]): Member[];
  batchOperations(operations: {
    add: Member[];
    update: { id: string; updateFn: (member: Member) => Member }[];
    delete: string[];
  }): void;
}
