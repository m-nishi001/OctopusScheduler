/**
 * @file ScreenSetting.ts
 * @description
 * 画面設定に関するデータ構造を定義します。
 * - ScreenSettingItemDto: スプレッドシートの1行に相当する、単一の設定項目を表すDTO。
 * - AssembledScreenSetting: 複数の設定項目を組み立ててクライアントに返す、ネストされたオブジェクトの型。
 */

import type { ISerializable } from '../../repository/ISerializable';

/**
 * スプレッドシートの1行に相当する、単一の設定項目を表すDTO (Data Transfer Object)。
 * 各画面設定シート（common_settings, entrance_settingsなど）は、この構造のレコードを複数持ちます。
 * RepositoryServiceによって永続化される際の基本単位となります。
 */
export interface ScreenSettingItemDto extends ISerializable {
    /**
     * ISerializableインターフェースを満たすための一意なID。
     * 各設定項目（行）はUUIDによって識別されます。
     */
    id: string;

    /**
     * 設定項目を識別するためのキー。
     * ネスト構造や配列を表現するためにドット区切り記法（例: 'audio.onClick', 'opening.scenes.0.id'）を使用します。
     */
    key: string;

    /**
     * 設定値。
     * スプレッドシート上ではすべて文字列として保存されますが、
     * アプリケーションサービス層で必要に応じて型変換（文字列→数値など）が行われます。
     */
    value: string;

    /**
     * スプレッドシート上での可読性を高めるための、設定項目の説明。
     * 主に運用者が内容を把握するために使用されます。
     */
    description: string;
}

/**
 * サーバーサイドで複数のScreenSettingItemDtoを組み立てた後、
 * クライアントに返される最終的な画面設定オブジェクトの型。
 * ドット区切りのキーがネストしたオブジェクト構造に変換されています。
 * この型は汎用的であり、オブジェクトや配列を含む任意の構造を表現できます。
 *
 * @example
 * // 変換元のDTO配列:
 * // [
 * //   { key: 'audio.onClick', value: 'se-click.wav' },
 * //   { key: 'opening.scenes.0.id', value: 'scene-1' },
 * //   { key: 'opening.scenes.0.display.content', value: '<p>Hello</p>' }
 * // ]
 *
 * // 変換後のAssembledScreenSettingオブジェクト:
 * // {
 * //   audio: {
 * //     onClick: 'se-click.wav'
 * //   },
 * //   opening: {
 * //     scenes: [
 * //       { id: 'scene-1', display: { content: '<p>Hello</p>' } }
 * //     ]
 * //   }
 * // }
 */
export interface AssembledScreenSetting {
    [key: string]: any;
}
