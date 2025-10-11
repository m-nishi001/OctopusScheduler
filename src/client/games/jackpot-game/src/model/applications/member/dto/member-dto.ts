import type { Member } from "../../../domains/member/member";

export interface MemberDto {
  id: string;
  name: string;
  photoAssetId?: string;
  rank: number;
}

export const toMember = (dto: MemberDto): Member => ({
  id: dto.id,
  name: dto.name,
  photoAssetId: dto.photoAssetId,
  rank: dto.rank,
});

export const fromMember = (member: Member): MemberDto => ({
  id: member.id,
  name: member.name,
  photoAssetId: member.photoAssetId,
  rank: member.rank,
});
