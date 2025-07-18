/**
 * @file Member.ts
 * @description メンバーエンティティ。サーバーサイドのビジネスロジックを担う。
 */

import { ISerializable } from '../../repository/ISerializable';

/**
 * クライアントに返すメンバー情報のDTO (Data Transfer Object)
 */
export type MemberDto = {
    id: string;
    name: string;
    nickname: string;
    message: string;
    imageAssetName: string | null;
};

/**
 * メンバーエンティティクラス。
 * ISerializableを実装し、RepositoryServiceによる永続化を可能にする。
 */
export class Member implements ISerializable {
    public readonly id: string;
    public name: string;
    public nickname: string;
    public message: string;
    public imageAssetName: string | null;

    /**
     * インスタンスの生成はファクトリメソッド経由で行うため、コンストラクタはprivateとする。
     * @param id - メンバーの一意なID
     * @param name - 名前
     * @param nickname - あだな
     * @param message - ひとことメッセージ
     * @param imageAssetName - 【変更】紐づく画像アセットの名前
     */
    private constructor(id: string, name: string, nickname: string, message: string, imageAssetName: string | null) {
        if (!id) throw new Error('ID is required for a Member.');
        if (!name || name.trim() === '') throw new Error('Name is required for a Member.');

        this.id = id;
        this.name = name;
        this.nickname = nickname;
        this.message = message;
        this.imageAssetName = imageAssetName;
    }

    /**
     * ファクトリメソッド: 新しいメンバーインスタンスを生成する。
     * IDはここで採番される。
     * @param name - 名前
     * @param nickname - あだな
     * @param message - メッセージ
     * @returns 新しいMemberインスタンス
     */
    public static create(name: string, nickname: string, message: string): Member {
        const newId = Utilities.getUuid();
        return new Member(newId, name, nickname, message, null);
    }

    /**
     * ファクトリメソッド: 永続化されたプレーンオブジェクトからインスタンスを再構成する。
     * @param data - リポジトリから取得したデータ (DTO)
     * @returns 再構成されたMemberインスタンス
     */
    public static reconstruct(data: MemberDto): Member {
        // 【変更】imageAssetNameを使用して再構成
        return new Member(data.id, data.name, data.nickname, data.message, data.imageAssetName);
    }

    /**
     * メンバー情報を更新する。
     * @param newName - 新しい名前
     * @param newNickname - 新しいあだな
     * @param newMessage - 新しいメッセージ
     */
    public updateDetails(newName: string, newNickname: string, newMessage: string): void {
        if (!newName || newName.trim() === '') {
            throw new Error('Name cannot be empty.');
        }
        this.name = newName;
        this.nickname = newNickname;
        this.message = newMessage;
    }

    /**
     * 画像との紐付けを解除する。
     */
    public removeImage(): void {
        this.imageAssetName = null;
    }

    /**
     * クライアントに返すためのDTO (Data Transfer Object) に変換する。
     * @returns プレーンなメンバー情報オブジェクト
     */
    public toDto(): MemberDto {
        return {
            id: this.id,
            name: this.name,
            nickname: this.nickname,
            message: this.message,
            imageAssetName: this.imageAssetName,
        };
    }
}
