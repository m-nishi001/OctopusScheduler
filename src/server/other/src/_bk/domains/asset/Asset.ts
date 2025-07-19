/**
 * @file Asset.ts
 * @description
 * アプリケーションで使用されるメディア資産（SE, BGMなど）の
 * メタデータに関するデータ構造を定義します。
 */

import type { ISerializable } from '../../repository/ISerializable';

/**
 * 'assets'シートの1行に相当する、メディア資産のメタデータを表すDTO。
 * RepositoryServiceによって永続化される際の基本単位となります。
 */
export interface AssetDto extends ISerializable {
    /**
     * ISerializableインターフェースを満たすための一意なID (UUID)。
     */
    id: string;

    /**
     * アセットを識別するためのユニークな名前 (例: 'common-click', 'home-bgm')。
     * これは画面設定シートから参照される際のキーとして機能し、
     * クライアントサイドのIndexedDBに保存される際の`dataId`にもなります。
     */
    name: string;

    /**
     * アセットの種類 ('se', 'bgm', 'image' など)。
     * 管理画面でのフィルタリングや、クライアントでの分類に使用します。
     */
    assetType: 'se' | 'bgm' | 'image' | 'other';

    /**
     * Google Driveに保存されている実ファイルのID。
     * このIDを使って、サーバーはファイル本体を取得します。
     */
    driveFileId: string;

    /**
     * ファイルのMIMEタイプ (例: 'audio/mpeg', 'image/png')。
     * クライアントがファイルを取り扱う際に使用します。
     */
    mimeType: string;

    /**
     * ファイルの最終更新日時。
     * クライアントは、このタイムスタンプを利用して、
     * IndexedDBにキャッシュされたデータが最新であるかを判断します。
     */
    updatedAt: Date;

    /**
     * スプレッドシート上での可読性を高めるための、アセットの説明。
     */
    description: string;
}

/**
 * クライアントにアセットのファイル本体を転送するためのデータ構造。
 * IndexedDBのDataItem型と互換性があるように設計されています。
 */
export interface AssetData {
    dataId: string;     // AssetDtoの'name'が入る
    dataType: string;   // AssetDtoの'assetType'が入る
    name: string;       // AssetDtoの'name'が入る
    mimeType: string;   // 【変更】BlobからMIMEタイプを渡すために追加
    dataBody: string;   // 【変更】BlobをBase64エンコードした文字列を格納
    updatedAt: Date;    // クライアントでの更新チェック用
}
