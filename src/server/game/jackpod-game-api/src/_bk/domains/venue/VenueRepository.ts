/**
 * @file VenueRepository.ts
 * @description
 * 会場エンティティの永続化をRepositoryServiceを介して行います。
 * ドメインオブジェクト(Venue)と永続化層のデータ(VenueDto)間の変換を行う責務を持ちます。
 */

import { Venue, type VenueDto } from './Venue';
import { RepositoryService } from '../../repository/RepositoryService';

// 会場情報を格納するスプレッドシートのシート名
const SHEET_NAME = 'venues';

/**
 * 会場リポジトリクラス。
 */
export class VenueRepository {
    // RepositoryServiceの型パラメータには、永続化するデータの型であるDTOを指定します。
    private readonly repository: RepositoryService<VenueDto>;

    constructor() {
        this.repository = new RepositoryService<VenueDto>(SHEET_NAME);
    }

    /**
     * IDで会場を検索します。
     * @param id - 検索する会場のID
     * @returns 見つかった場合はVenueエンティティ、見つからない場合はnull
     */
    public findById(id: string): Venue | null {
        // 1. RepositoryServiceからDTOを読み込みます。
        const dto = this.repository.read(id);
        if (!dto) {
            return null;
        }
        // 2. DTOからドメインエンティティを再構成して返します。
        return Venue.reconstruct(dto);
    }

    /**
     * 全ての会場を取得します。
     * @returns Venueエンティティの配列
     */
    public findAll(): Venue[] {
        const dtoList = this.repository.list();
        // 全てのDTOをドメインエンティティに変換して返します。
        return dtoList.map(dto => Venue.reconstruct(dto));
    }

    /**
     * 会場エンティティを永続化（新規作成または更新）します。
     * @param venue - 保存するVenueエンティティ
     */
    public save(venue: Venue): void {
        // 1. ドメインエンティティを永続化用のDTOに変換します。
        const dto = venue.toDto();
        // 2. RepositoryServiceのupsertメソッドでデータの作成または更新を行います。
        this.repository.upsert(dto);
    }

    /**
     * IDを指定して会場を削除します。
     * @param id - 削除する会場のID
     */
    public delete(id: string): void {
        this.repository.delete(id);
    }
}
