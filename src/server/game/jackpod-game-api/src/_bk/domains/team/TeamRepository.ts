/**
 * @file TeamRepository.ts
 * @description
 * チームエンティティの永続化をRepositoryServiceを介して行います。
 * ドメインオブジェクト(Team)と永続化層のデータ(TeamDto)間の変換を行う責務を持ちます。
 */

import { Team, type TeamDto } from './Team';
import { RepositoryService } from '../../repository/RepositoryService';

// チーム情報を格納するスプレッドシートのシート名
const SHEET_NAME = 'teams';

/**
 * チームリポジトリクラス。
 */
export class TeamRepository {
    // RepositoryServiceの型パラメータには、永続化するデータの型であるDTOを指定します。
    private readonly repository: RepositoryService<TeamDto>;

    constructor() {
        this.repository = new RepositoryService<TeamDto>(SHEET_NAME);
    }

    /**
     * IDでチームを検索します。
     * @param id - 検索するチームのID
     * @returns 見つかった場合はTeamエンティティ、見つからない場合はnull
     */
    public findById(id: string): Team | null {
        // 1. RepositoryServiceからDTOを読み込みます。
        const dto = this.repository.read(id);
        if (!dto) {
            return null;
        }
        // 2. DTOからドメインエンティティを再構成して返します。
        return Team.reconstruct(dto);
    }

    /**
     * 全てのチームを取得します。
     * @returns Teamエンティティの配列
     */
    public findAll(): Team[] {
        const dtoList = this.repository.list();
        // 全てのDTOをドメインエンティティに変換して返します。
        return dtoList.map(dto => Team.reconstruct(dto));
    }

    /**
     * チームエンティティを永続化（新規作成または更新）します。
     * @param team - 保存するTeamエンティティ
     */
    public save(team: Team): void {
        // 1. ドメインエンティティを永続化用のDTOに変換します。
        const dto = team.toDto();
        // 2. RepositoryServiceのupsertメソッドでデータの作成または更新を行います。
        this.repository.upsert(dto);
    }

    /**
     * IDを指定してチームを削除します。
     * @param id - 削除するチームのID
     */
    public delete(id: string): void {
        this.repository.delete(id);
    }
}
