import { Member } from "../../domain/member/member";
import { MemberDto } from "./member-dto";

export function toMemberDto(entity: Member): MemberDto {
  return {
    id: entity.id,
    name: entity.name,
    photoAssetId: entity.photoAssetId, //
    rank: entity.rank,
  };
}

export function toMember(entity: MemberDto): Member {
  return {
    id: entity.id,
    name: entity.name,
    photoAssetId: entity.photoAssetId ?? "",
    rank: entity.rank ?? 0,
  };
}
