/**
 * @file GameRepository.ts
 * @description
 * ゲームエンティティの永続化をRepositoryServiceを介して行います。
 * ドメインオブジェクト(Game)と永続化層のデータ(GameDto)間の変換を行う責務を持ちます。
 */

import { Game, type GameDto } from './Game';
import { RepositoryService } from '../../repository/RepositoryService';

// ゲーム情報を格納するスプレッドシートのシート名
const SHEET_NAME = 'games';

/**
 * ゲームリポジトリクラス。
 */
export class GameRepository {
    // RepositoryServiceの型パラメータには、永続化するデータの型であるDTOを指定します。
    private readonly repository: RepositoryService<GameDto>;

    constructor() {
        this.repository = new RepositoryService<GameDto>(SHEET_NAME);
    }

    /**
     * IDでゲームを検索します。
     * @param id - 検索するゲームのID
     * @returns 見つかった場合はGameエンティティ、見つからない場合はnull
     */
    public findById(id: string): Game | null {
        // 1. RepositoryServiceからDTOを読み込みます。
        const dto = this.repository.read(id);
        if (!dto) {
            return null;
        }
        // 2. DTOからドメインエンティティを再構成して返します。
        return Game.reconstruct(dto);
    }

    /**
     * 全てのゲームを取得します。
     * @returns Gameエンティティの配列
     */
    public findAll(): Game[] {
        const dtoList = this.repository.list();
        // 全てのDTOをドメインエンティティに変換して返します。
        return dtoList.map(dto => Game.reconstruct(dto));
    }

    /**
     * ゲームエンティティを永続化（新規作成または更新）します。
     * @param game - 保存するGameエンティティ
     */
    public save(game: Game): void {
        // 1. ドメインエンティティを永続化用のDTOに変換します。
        const dto = game.toDto();
        // 2. RepositoryServiceのupsertメソッドでデータの作成または更新を行います。
        this.repository.upsert(dto);
    }

    /**
     * IDを指定してゲームを削除します。
     * @param id - 削除するゲームのID
     */
    public delete(id: string): void {
        this.repository.delete(id);
    }
}
