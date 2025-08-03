/**
 * @file ScreenSettingApplicationService.ts
 * @description
 * 画面設定に関するユースケース（アプリケーションサービス）を実装します。
 * 永続化層（リポジトリ）とクライアントAPIの間に位置し、ビジネスロジックの中核を担います。
 * 【変更】配列を含む設定（オープニングシーンなど）に対応しました。
 */

import { ScreenSettingRepository } from './ScreenSettingRepository';
import type { AssembledScreenSetting, ScreenSettingItemDto } from './ScreenSetting';
import { stringify } from 'querystring';

// --- 定数定義 ---

/**
 * アプリケーション共通の設定が保存されているシート名。
 */
const COMMON_SETTINGS_SHEET = 'common_settings';

/**
 * 各画面固有の設定が保存されているシート名の接尾辞。
 * 例: 'home'画面の設定は 'home_settings' シートに保存される。
 */
const SCREEN_SETTINGS_SUFFIX = '_settings';


/**
 * 画面設定に関するユースケースを実現するサービスクラス。
 */
export class ScreenSettingApplicationService {
    private readonly settingRepository: ScreenSettingRepository;

    constructor() {
        this.settingRepository = new ScreenSettingRepository();
    }

    /**
     * ユースケース: 指定された画面の、最終的に適用される設定オブジェクトを取得します。
     * 共通設定と個別設定をマージし、個別設定で共通設定をオーバーライドします。
     * @param screenId - 設定を取得したい画面のID (例: 'home', 'entrance')
     * @returns 組み立て済みの設定オブジェクト (AssembledScreenSetting)
     */
    public getScreenConfig(screenId: string): AssembledScreenSetting {
        const commonSettingsItems = this.settingRepository.findAllBySheet(COMMON_SETTINGS_SHEET);
        const commonConfig = this.assembleSettings(commonSettingsItems);

        // "common"が指定された場合は、個別設定を読み込まず共通設定のみを返す
        if (screenId === 'common') {
            return commonConfig;
        }

        const screenSheetName = `${screenId}${SCREEN_SETTINGS_SUFFIX}`;
        const screenSettingsItems = this.settingRepository.findAllBySheet(screenSheetName);
        const screenConfig = this.assembleSettings(screenSettingsItems);

        return this.deepMerge(commonConfig, screenConfig);
    }

    /**
     * ユースケース: 指定された画面の個別設定を保存します。
     * @param screenId - 保存対象の画面ID
     * @param configToSave - クライアントから送信された、ネストされた設定オブジェクト
     */
    public saveScreenConfig(screenId: string, configToSave: AssembledScreenSetting): void {
        const sheetName = (screenId === 'common')
            ? COMMON_SETTINGS_SHEET
            : `${screenId}${SCREEN_SETTINGS_SUFFIX}`;

        const existingItems = this.settingRepository.findAllBySheet(sheetName);
        const itemsToSave = this.disassembleSettings(configToSave, existingItems);

        // 【修正】スプレッドシートの直接操作ロジックをリポジトリ層に移譲したため、以下のコードブロックを削除。
        // これにより、getActiveSpreadsheet() に起因するエラーが解消される。
        this.settingRepository.saveAll(sheetName, itemsToSave);
    }


    /**
     * ユースケース: 指定された複数の音源アセットが、どの画面設定で使用されているかを一括で検索します。
     * @param assetNames - 検索対象のアセット名の配列 (例: ['common-click', 'home-bgm'])
     * @returns キーがアセット名、値が使用されている画面名の配列であるオブジェクト
     */
    public findAssetUsage(assetNames: string[]): Record<string, string[]> {
        if (!assetNames || assetNames.length === 0) {
            return {};
        }

        const usageMap: Record<string, string[]> = Object.fromEntries(
            assetNames.map(name => [name, []])
        );
        const assetNameSet = new Set(assetNames);

        const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
        if (!spreadsheet) {
            // スプレッドシートが取得できない場合は空のマップを返す
            console.error("Could not get active spreadsheet to find asset usage.");
            return usageMap;
        }
        const allSheets = spreadsheet.getSheets();

        for (const sheet of allSheets) {
            const sheetName = sheet.getName();
            if (sheetName.endsWith(SCREEN_SETTINGS_SUFFIX) || sheetName === COMMON_SETTINGS_SHEET) {
                const screenId = sheetName.replace(SCREEN_SETTINGS_SUFFIX, '');
                const settings = this.settingRepository.findAllBySheet(sheetName);

                for (const setting of settings) {
                    if (assetNameSet.has(setting.value)) {
                        if (!usageMap[setting.value].includes(screenId)) {
                            usageMap[setting.value].push(screenId);
                        }
                    }
                }
            }
        }
        return usageMap;
    }


    // --- Private Helper Methods ---

    /**
     * 【改修】ScreenSettingItemDtoの配列を、配列を含むネストされたオブジェクトに組み立て直します。
     * @param items - スプレッドシートから読み込んだ設定項目の配列
     * @returns 組み立てられた設定オブジェクト
     */
    private assembleSettings(items: ScreenSettingItemDto[]): AssembledScreenSetting {
        const assembled: AssembledScreenSetting = {};

        for (const item of items) {
            const keys = item.key.split('.');
            let currentLevel: any = assembled;

            for (let i = 0; i < keys.length; i++) {
                const key = keys[i];
                const nextKey = keys[i + 1];
                const isLastKey = i === keys.length - 1;

                if (isLastKey) {
                    currentLevel[key] = this.convertValueType(item.value);
                } else {
                    const isNextKeyArrayIndex = /^\d+$/.test(nextKey);
                    if (!currentLevel[key] || typeof currentLevel[key] !== 'object') {
                        currentLevel[key] = isNextKeyArrayIndex ? [] : {};
                    }
                    currentLevel = currentLevel[key];
                }
            }
        }

        return assembled;
    }

    /**
     * 【改修】配列を含むネストされた設定オブジェクトを、永続化用のフラットなDTO配列に分解します。
     * @param setting - 保存対象のネストされたオブジェクト
     * @param existingItems - 既存のDTO配列（IDや説明を保持するため）
     * @returns 永続化用のDTO配列
     */
    private disassembleSettings(setting: AssembledScreenSetting, existingItems: ScreenSettingItemDto[]): ScreenSettingItemDto[] {
        const newItems: ScreenSettingItemDto[] = [];
        const existingMap = new Map(existingItems.map(item => [item.key, item]));

        const flatten = (obj: any, prefix = ''): { key: string; value: string }[] => {
            if (obj === null || obj === undefined) {
                return [];
            }
            return Object.entries(obj).reduce((acc, [key, value]) => {
                const newKey = prefix ? `${prefix}.${key}` : key;
                if (typeof value === 'object' && value !== null) {
                    acc.push(...flatten(value, newKey));
                } else {
                    acc.push({ key: newKey, value: String(value) });
                }
                return acc;
            }, [] as { key: string; value: string }[]);
        };

        const flatSettings = flatten(setting);

        for (const { key, value } of flatSettings) {
            const existing = existingMap.get(key);
            if (existing) {
                newItems.push({ ...existing, value });
            } else {
                newItems.push({
                    id: Utilities.getUuid(),
                    key,
                    value,
                    description: ''
                });
            }
        }

        return newItems;
    }


    private convertValueType(value: string): string | number | boolean | null {
        if (value === null || value === undefined) return null;

        const trimmedValue = String(value).trim();
        if (trimmedValue.toLowerCase() === 'true') return true;
        if (trimmedValue.toLowerCase() === 'false') return false;
        if (trimmedValue === '') return value;
        if (!isNaN(Number(trimmedValue))) {
            return Number(trimmedValue);
        }
        return value;
    }

    private deepMerge(target: any, source: any): any {
        const output = { ...target };
        if (this.isObject(target) && this.isObject(source)) {
            Object.keys(source).forEach(key => {
                if (this.isObject(source[key])) {
                    if (!(key in target)) {
                        Object.assign(output, { [key]: source[key] });
                    } else {
                        output[key] = this.deepMerge(target[key], source[key]);
                    }
                } else {
                    Object.assign(output, { [key]: source[key] });
                }
            });
        }
        return output;
    }

    private isObject(item: any): boolean {
        return (item && typeof item === 'object' && !Array.isArray(item));
    }
}
