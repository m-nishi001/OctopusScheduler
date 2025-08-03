/**
 * @file Team.ts
 * @description
 * イベント内で使用される「チーム」に関するドメインエンティティとデータ転送オブジェクト(DTO)を定義します。
 */

import type { ISerializable } from '../../repository/ISerializable';

/**
 * 'teams'シートの1行に相当する、チームのメタデータを表すDTO (Data Transfer Object)。
 * RepositoryServiceによって永続化される際の基本単位となります。
 */
export interface TeamDto extends ISerializable {
    /**
     * ISerializableインターフェースを満たすための一意なID (UUID)。
     */
    id: string;

    /**
     * チームの名称。 (例: 「Aチーム」, 「赤組」)
     */
    name: string;

    /**
     * 管理画面で運用者が使用するための備考欄。
     */
    remarks: string;

    /**
     * チームの定員。
     * 今回の要件では抽選ロジックには使用しませんが、今後の拡張のために保持します。
     */
    capacity: number;
}

/**
 * チームエンティティクラス。
 * チームに関するビジネスルールと状態を管理する責務を持ちます。
 * ISerializableを実装し、RepositoryServiceによる永続化を可能にします。
 */
export class Team implements ISerializable {
    public readonly id: string;
    private _name: string;
    private _remarks: string;
    private _capacity: number;

    /**
     * インスタンスの生成はファクトリメソッド経由で行うため、コンストラクタはprivateとします。
     * @param id - チームの一意なID
     * @param name - チーム名
     * @param remarks - 備考
     * @param capacity - 定員
     */
    private constructor(id: string, name: string, remarks: string, capacity: number) {
        // --- 不変条件 (Invariant) のチェック ---
        if (!id) throw new Error('ID is required for a Team.');
        if (!name || name.trim() === '') throw new Error('Team name is required.');
        if (capacity < 1 || capacity > 99) {
            throw new Error('Capacity must be between 1 and 99.');
        }

        this.id = id;
        this._name = name;
        this._remarks = remarks;
        this._capacity = capacity;
    }

    /**
     * ファクトリメソッド: 新しいチームインスタンスを生成します。
     * @param name - チーム名
     * @param remarks - 備考
     * @param capacity - 定員
     * @returns 新しいTeamインスタンス
     */
    public static create(name: string, remarks: string, capacity: number): Team {
        const newId = Utilities.getUuid();
        return new Team(newId, name, remarks, capacity);
    }

    /**
     * ファクトリメソッド: 永続化されたプレーンなデータオブジェクトからインスタンスを再構成します。
     * @param dto - リポジトリから取得したデータ (TeamDto)
     * @returns 再構成されたTeamインスタンス
     */
    public static reconstruct(dto: TeamDto): Team {
        return new Team(dto.id, dto.name, dto.remarks, dto.capacity);
    }

    /**
     * チーム情報を更新します。
     * @param name - 新しいチーム名
     * @param remarks - 新しい備考
     * @param capacity - 新しい定員
     */
    public updateDetails(name: string, remarks: string, capacity: number): void {
        if (!name || name.trim() === '') {
            throw new Error('Team name cannot be empty.');
        }
        if (capacity < 1 || capacity > 99) {
            throw new Error('Capacity must be between 1 and 99.');
        }
        this._name = name;
        this._remarks = remarks;
        this._capacity = capacity;
    }

    // --- ゲッター (Getter) ---
    get name(): string { return this._name; }
    get remarks(): string { return this._remarks; }
    get capacity(): number { return this._capacity; }

    /**
     * 永続化やクライアントへの転送のために、エンティティをDTOに変換します。
     * @returns プレーンなチーム情報オブジェクト (TeamDto)
     */
    public toDto(): TeamDto {
        return {
            id: this.id,
            name: this._name,
            remarks: this._remarks,
            capacity: this._capacity,
        };
    }
}
