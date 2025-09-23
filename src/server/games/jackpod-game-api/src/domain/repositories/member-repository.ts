import { Member } from "../../domain/entities/member";

export interface IMemberRepository {
  findAll(): Promise<Member[]>;
  findById(id: string): Promise<Member | null>;
  save(member: Member): Promise<void>;
  delete(id: string): Promise<void>;
}
