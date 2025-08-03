/**
 * @file Venue.ts
 * @description
 * イベントで使用される「会場」に関するドメインエンティティとデータ転送オブジェクト(DTO)を定義します。
 */

import type { ISerializable } from '../../repository/ISerializable';

/**
 * 'venues'シートの1行に相当する、会場のメタデータを表すDTO (Data Transfer Object)。
 * RepositoryServiceによって永続化される際の基本単位となります。
 */
export interface VenueDto extends ISerializable {
    /**
     * ISerializableインターフェースを満たすための一意なID (UUID)。
     */
    id: string;

    /**
     * 会場の名称。 (例: 「第一会議室」, 「プレイルームA」)
     */
    name: string;

    /**
     * 管理画面で運用者が使用するための備考欄。
     */
    remarks: string;

    /**
     * 会場の定員。
     * 今回の要件では抽選ロジックには使用しませんが、今後の拡張のために保持します。
     */
    capacity: number;
}

/**
 * 会場エンティティクラス。
 * 会場に関するビジネスルールと状態を管理する責務を持ちます。
 * ISerializableを実装し、RepositoryServiceによる永続化を可能にします。
 */
export class Venue implements ISerializable {
    public readonly id: string;
    private _name: string;
    private _remarks: string;
    private _capacity: number;

    /**
     * インスタンスの生成はファクトリメソッド経由で行うため、コンストラクタはprivateとします。
     * @param id - 会場の一意なID
     * @param name - 会場名
     * @param remarks - 備考
     * @param capacity - 定員
     */
    private constructor(id: string, name: string, remarks: string, capacity: number) {
        // --- 不変条件 (Invariant) のチェック ---
        if (!id) throw new Error('ID is required for a Venue.');
        if (!name || name.trim() === '') throw new Error('Venue name is required.');
        if (capacity < 1 || capacity > 99) {
            throw new Error('Capacity must be between 1 and 99.');
        }

        this.id = id;
        this._name = name;
        this._remarks = remarks;
        this._capacity = capacity;
    }

    /**
     * ファクトリメソッド: 新しい会場インスタンスを生成します。
     * @param name - 会場名
     * @param remarks - 備考
     * @param capacity - 定員
     * @returns 新しいVenueインスタンス
     */
    public static create(name: string, remarks: string, capacity: number): Venue {
        const newId = Utilities.getUuid();
        return new Venue(newId, name, remarks, capacity);
    }

    /**
     * ファクトリメソッド: 永続化されたプレーンなデータオブジェクトからインスタンスを再構成します。
     * @param dto - リポジトリから取得したデータ (VenueDto)
     * @returns 再構成されたVenueインスタンス
     */
    public static reconstruct(dto: VenueDto): Venue {
        return new Venue(dto.id, dto.name, dto.remarks, dto.capacity);
    }

    /**
     * 会場情報を更新します。
     * @param name - 新しい会場名
     * @param remarks - 新しい備考
     * @param capacity - 新しい定員
     */
    public updateDetails(name: string, remarks: string, capacity: number): void {
        if (!name || name.trim() === '') {
            throw new Error('Venue name cannot be empty.');
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
     * @returns プレーンな会場情報オブジェクト (VenueDto)
     */
    public toDto(): VenueDto {
        return {
            id: this.id,
            name: this._name,
            remarks: this._remarks,
            capacity: this._capacity,
        };
    }
}
