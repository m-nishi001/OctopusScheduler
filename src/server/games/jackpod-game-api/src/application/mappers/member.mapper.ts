import { Member } from "../../domain/entities/member";
import { MemberDto } from "../dtos/member.dto";

export function toMemberDto(entity: Member): MemberDto {
  return {
    id: entity.id,
    name: entity.name,
    photoAssetId: entity.photoAssetId, // 仕様に合わせて変換
    order: 0, // 必要に応じて
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
