import { Member } from "../../domain/member/member";
import { MemberDto } from "./member-dto";

export function toMemberDto(entity: Member): MemberDto {
  return {
    id: entity.id,
    name: entity.name,
    photoAssetId: entity.photoAssetId, //
    order: entity.order,
  };
}

export function toMember(entity: MemberDto): Member {
  return {
    id: entity.id,
    name: entity.name,
    photoAssetId: entity.photoAssetId ?? "",
    order: entity.order ?? 0,
  };
}
