/**
 * @file MemberRepository.ts
 * @description メンバーエンティティの永続化をRepositoryServiceを介して行う。
 */

import { Member, MemberDto } from './Member';
import { RepositoryService } from '../../repository/RepositoryService';

// メンバー情報を格納するシート名
const SHEET_NAME = 'members';

/**
 * メンバーリポジトリクラス。
 * ドメインオブジェクト（Member）と永続化層のデータ（MemberDto）間の変換を行う責務を持つ。
 */
export class MemberRepository {
    // RepositoryServiceの型パラメータには、永続化するデータの型（DTO）を指定する
    private readonly repository: RepositoryService<MemberDto>;

    constructor() {
        this.repository = new RepositoryService<MemberDto>(SHEET_NAME);
    }

    /**
     * IDでメンバーを検索する。
     * @param id - 検索するメンバーのID
     * @returns 見つかった場合はMemberエンティティ、見つからない場合はnull
     */
    public findById(id: string): Member | null {
        // RepositoryServiceからDTOを読み込む
        const dto = this.repository.read(id);
        if (!dto) {
            return null;
        }
        // DTOからドメインエンティティを再構成して返す
        return Member.reconstruct(dto);
    }

    /**
     * 全てのメンバーを取得する。
     * @returns Memberエンティティの配列
     */
    public findAll(): Member[] {
        const dtoList = this.repository.list();
        // 全てのDTOをドメインエンティティに変換して返す
        return dtoList.map(dto => Member.reconstruct(dto));
    }

    /**
     * メンバーを永続化（新規作成または更新）する。
     * @param member - 保存するMemberエンティティ
     */
    public save(member: Member): void {
        // ドメインエンティティを永続化用のDTOに変換
        const dto = member.toDto();
        // RepositoryServiceのupsertメソッドでデータの作成・更新を行う
        this.repository.upsert(dto);
    }

    /**
     * メンバーを削除する。
     * @param id - 削除するメンバーのID
     */
    public delete(id: string): void {
        this.repository.delete(id);
    }
}
