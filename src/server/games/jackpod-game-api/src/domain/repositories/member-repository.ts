import { Member } from "../../domain/entities/member";

export interface IMemberRepository {
  findAll(): Member[];
  findById(id: string): Member | null;
  findManyByIds(ids: string[]): Member[];
  add(member: Member): Member;
  addMany(members: Member[]): Member[];
  update(id: string, updateEntity: (member: Member) => Member): number;
  updateMany(ids: string[], updateEntity: (member: Member) => Member): number;
  delete(id: string): void;
  deleteMany(ids: string[]): void;
}
