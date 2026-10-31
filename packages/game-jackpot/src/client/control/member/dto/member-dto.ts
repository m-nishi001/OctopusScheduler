import type { Member } from "../../../model/member/member";

export interface MemberDto {
  id: string;
  name: string;
  photo?: string;
  rank: number;
  weight?: number;
}

/** 画面用の `MemberDto` を、モデルの `Member` にする。 */
export const toMember = (dto: MemberDto): Member => ({
  id: dto.id,
  name: dto.name,
  photo: dto.photo,
  rank: dto.rank,
  weight: dto.weight,
});

/** モデルの `Member` を、画面用の `MemberDto` にする。 */
export const fromMember = (member: Member): MemberDto => ({
  id: member.id,
  name: member.name,
  photo: member.photo,
  rank: member.rank,
  weight: member.weight,
});
