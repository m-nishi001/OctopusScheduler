import type { Member } from "../../../model/member/member";

export interface MemberDto {
  id: string;
  name: string;
  photo?: string;
  weight?: number;
}

/** 画面用の `MemberDto` を、モデルの `Member` にする。 */
export const toMember = (dto: MemberDto): Member => ({
  id: dto.id,
  name: dto.name,
  photo: dto.photo,
  weight: dto.weight,
});

/** モデルの `Member` を、画面用の `MemberDto` にする。 */
export const fromMember = (member: Member): MemberDto => ({
  id: member.id,
  name: member.name,
  photo: member.photo,
  weight: member.weight,
});
