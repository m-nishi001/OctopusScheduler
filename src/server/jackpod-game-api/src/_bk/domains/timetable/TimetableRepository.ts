/**
 * @file TimetableRepository.ts
 * @description
 * タイムテーブルエンティティの永続化をRepositoryServiceを介して行います。
 * ドメインオブジェクト(Timetable)と永続化層のデータ(TimetableDto)間の変換を行う責務を持ちます。
 */

import { Timetable, type TimetableDto } from './Timetable';
import { RepositoryService } from '../../repository/RepositoryService';

// タイムテーブル情報を格納するスプレッドシートのシート名
const SHEET_NAME = 'timetables';

/**
 * タイムテーブルリポジトリクラス。
 */
export class TimetableRepository {
    // RepositoryServiceの型パラメータには、永続化するデータの型であるDTOを指定します。
    private readonly repository: RepositoryService<TimetableDto>;

    constructor() {
        this.repository = new RepositoryService<TimetableDto>(SHEET_NAME);
    }

    /**
     * IDでタイムテーブル項目を検索します。
     * @param id - 検索するタイムテーブル項目のID
     * @returns 見つかった場合はTimetableエンティティ、見つからない場合はnull
     */
    public findById(id: string): Timetable | null {
        // 1. RepositoryServiceからDTOを読み込みます。
        const dto = this.repository.read(id);
        if (!dto) {
            return null;
        }
        // 2. DTOからドメインエンティティを再構成して返します。
        return Timetable.reconstruct(dto);
    }

    /**
     * 全てのタイムテーブル項目を取得します。
     * @returns Timetableエンティティの配列
     */
    public findAll(): Timetable[] {
        const dtoList = this.repository.list();
        console.log(JSON.stringify(dtoList));
        // 全てのDTOをドメインエンティティに変換して返します。
        return dtoList.map(dto => Timetable.reconstruct(dto));
    }

    /**
     * タイムテーブルエンティティを永続化（新規作成または更新）します。
     * @param timetable - 保存するTimetableエンティティ
     */
    public save(timetable: Timetable): void {
        // 1. ドメインエンティティを永続化用のDTOに変換します。
        const dto = timetable.toDto();
        // 2. RepositoryServiceのupsertメソッドでデータの作成または更新を行います。
        this.repository.upsert(dto);
    }

    /**
     * 【新規追加】複数のタイムテーブルエンティティを一括で永続化（全件置き換え）します。
     * 管理画面での順序変更や削除を反映させるために使用します。
     * @param timetables - 保存するTimetableエンティティの配列
     */
    public saveAll(timetables: Timetable[]): void {
        const dtos = timetables.map(t => t.toDto());
        this.repository.replaceAll(dtos);
    }

    /**
     * IDを指定してタイムテーブル項目を削除します。
     * @param id - 削除するタイムテーブル項目のID
     */
    public delete(id: string): void {
        this.repository.delete(id);
    }
}
