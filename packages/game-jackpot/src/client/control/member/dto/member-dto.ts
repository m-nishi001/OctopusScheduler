import type { Member } from "../../../model/member/member";

export interface MemberDto {
  id: string;
  name: string;
  photoAssetId?: string;
  rank: number;
  weight?: number;
}

export const toMember = (dto: MemberDto): Member => ({
  id: dto.id,
  name: dto.name,
  photoAssetId: dto.photoAssetId,
  rank: dto.rank,
  weight: dto.weight,
});

export const fromMember = (member: Member): MemberDto => ({
  id: member.id,
  name: member.name,
  photoAssetId: member.photoAssetId,
  rank: member.rank,
  weight: member.weight,
});
