import { Member } from '../../domain/entities/member';
import { MemberDto } from './member-dto';

export function toMemberDto(entity: Member): MemberDto {
  return {
    id: entity.id,
    name: entity.name,
    photoAssetId: entity.photoUrl, // 仕様に合わせて変換
    order: 0 // 必要に応じて
  };
}

export function toMember(entity: MemberDto): Member {
  return {
    id: entity.id,
    name: entity.name,
    photoUrl: entity.photoAssetId ?? ''
  };
}
