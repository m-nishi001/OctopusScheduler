/**
 * @file ScreenSettingRepository.ts
 * @description
 * 画面設定の永続化をRepositoryServiceを介して行います。
 * このリポジトリは特定のシートに限定されず、指定されたシート名に基づいて
 * 動的に設定の読み書きを実行する責務を持ちます。
 */

import { RepositoryService } from '../../repository/RepositoryService';
import type { ScreenSettingItemDto } from './ScreenSetting';

/**
 * 画面設定リポジトリクラス。
 * 汎用的なRepositoryServiceを利用して、各設定シートへのアクセスを抽象化します。
 */
export class ScreenSettingRepository {
    /**
     * RepositoryServiceのインスタンスをシート名ごとにキャッシュするためのMap。
     * 同一リクエスト内で同じシートに何度もアクセスする際の効率を向上させます。
     */
    private readonly repositoryCache: Map<string, RepositoryService<ScreenSettingItemDto>>;

    constructor() {
        this.repositoryCache = new Map<string, RepositoryService<ScreenSettingItemDto>>();
    }

    /**
     * 指定されたシート名から、すべての設定項目を取得します。
     * @param sheetName - 取得元のシート名 (例: 'common_settings', 'home_settings')
     * @returns 指定されたシート内の全設定項目 (ScreenSettingItemDto) の配列
     */
    public findAllBySheet(sheetName: string): ScreenSettingItemDto[] {
        const repository = this.getRepository(sheetName);
        return repository.list();
    }

    /**
     * 指定されたシートに、単一の設定項目を保存（作成または更新）します。
     * @param sheetName - 保存先のシート名
     * @param settingItem - 保存する設定項目データ
     */
    public save(sheetName: string, settingItem: ScreenSettingItemDto): void {
        const repository = this.getRepository(sheetName);
        repository.upsert(settingItem);
    }

    /**
     * 指定されたシートに、複数の設定項目を一括で保存（作成または更新）します。
     * 【修正】実装を、既存のデータを全てクリアしてから一括で書き込む方式に変更。
     * これにより、設定項目が削除された場合にも正しく反映される。
     * @param sheetName - 保存先のシート名
     * @param settingItems - 保存する設定項目データの配列
     */
    public saveAll(sheetName: string, settingItems: ScreenSettingItemDto[]): void {
        const repository = this.getRepository(sheetName);
        // 各項目に対してupsertを実行するのではなく、全データを一括で置き換える
        repository.replaceAll(settingItems);
    }

    /**
     * 指定されたシートから、IDに基づいて単一の設定項目を削除します。
     * @param sheetName - 削除対象が存在するシート名
     * @param id - 削除する設定項目のID
     */
    public delete(sheetName: string, id: string): void {
        const repository = this.getRepository(sheetName);
        repository.delete(id);
    }

    /**
     * シート名に基づいてRepositoryServiceのインスタンスを取得または生成します。
     * インスタンスはキャッシュされ、再利用されます。
     * @param sheetName - 対象のシート名
     * @returns RepositoryService<ScreenSettingItemDto>のインスタンス
     */
    private getRepository(sheetName: string): RepositoryService<ScreenSettingItemDto> {
        // キャッシュに存在すれば、それを返す
        if (this.repositoryCache.has(sheetName)) {
            return this.repositoryCache.get(sheetName)!;
        }

        // キャッシュになければ、新しいインスタンスを生成してキャッシュに保存
        const newRepository = new RepositoryService<ScreenSettingItemDto>(sheetName);
        this.repositoryCache.set(sheetName, newRepository);

        return newRepository;
    }
}
