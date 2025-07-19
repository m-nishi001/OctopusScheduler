/**
 * @file Game.ts
 * @description
 * イベント内で使用される「ゲーム」に関するドメインエンティティとデータ転送オブジェクト(DTO)を定義します。
 * サーバーサイドのビジネスロジックの中核を担います。
 */

import type { ISerializable } from '../../repository/ISerializable';

/**
 * ゲームの種別を表す型。
 * 抽選ロジックで「なるべく同じゲーム種別が続かないようにする」という要件で使用されます。
 */
export type GameType = 'board' | 'tv' | 'card';

/**
 * 'games'シートの1行に相当する、ゲームのメタデータを表すDTO (Data Transfer Object)。
 * RepositoryServiceによって永続化される際の基本単位となります。
 * また、この形式でクライアントとデータを送受信します。
 */
export interface GameDto extends ISerializable {
    /**
     * ISerializableインターフェースを満たすための一意なID (UUID)。
     */
    id: string;

    /**
     * ゲームの名称。 (例: 「大富豪」, 「スマッシュブラザーズ」)
     */
    name: string;

    /**
     * ゲームの種別。
     */
    gameType: GameType;

    /**
     * 管理画面で運用者が使用するための備考欄。
     */
    remarks: string;

    /**
     * ゲームの定員。
     * 今回の要件では抽選ロジックには使用しませんが、今後の拡張のために保持します。
     */
    capacity: number;
}

/**
 * ゲームエンティティクラス。
 * ゲームに関するビジネスルールと状態を管理する責務を持ちます。
 * ISerializableを実装し、RepositoryServiceによる永続化を可能にします。
 */
export class Game implements ISerializable {
    public readonly id: string;
    private _name: string;
    private _gameType: GameType;
    private _remarks: string;
    private _capacity: number;

    /**
     * インスタンスの生成はファクトリメソッド経由で行うため、コンストラクタはprivateとします。
     * @param id - ゲームの一意なID
     * @param name - ゲーム名
     * @param gameType - ゲーム種別
     * @param remarks - 備考
     * @param capacity - 定員
     */
    private constructor(id: string, name: string, gameType: GameType, remarks: string, capacity: number) {
        // --- 不変条件 (Invariant) のチェック ---
        if (!id) throw new Error('ID is required for a Game.');
        if (!name || name.trim() === '') throw new Error('Game name is required.');
        if (capacity < 1 || capacity > 99) {
            throw new Error('Capacity must be between 1 and 99.');
        }

        this.id = id;
        this._name = name;
        this._gameType = gameType;
        this._remarks = remarks;
        this._capacity = capacity;
    }

    /**
     * ファクトリメソッド: 新しいゲームインスタンスを生成します。
     * 新規作成時はIDがまだ存在しないため、ここで採番します。
     * @param name - ゲーム名
     * @param gameType - ゲーム種別
     * @param remarks - 備考
     * @param capacity - 定員
     * @returns 新しいGameインスタンス
     */
    public static create(name: string, gameType: GameType, remarks: string, capacity: number): Game {
        const newId = Utilities.getUuid();
        return new Game(newId, name, gameType, remarks, capacity);
    }

    /**
     * ファクトリメソッド: 永続化されたプレーンなデータオブジェクトからインスタンスを再構成します。
     * @param dto - リポジトリから取得したデータ (GameDto)
     * @returns 再構成されたGameインスタンス
     */
    public static reconstruct(dto: GameDto): Game {
        return new Game(dto.id, dto.name, dto.gameType, dto.remarks, dto.capacity);
    }

    /**
     * ゲーム情報を更新します。
     * エンティティの状態を変更する振る舞い（メソッド）にビジネスルールをカプセル化します。
     * @param name - 新しいゲーム名
     * @param gameType - 新しいゲーム種別
     * @param remarks - 新しい備考
     * @param capacity - 新しい定員
     */
    public updateDetails(name: string, gameType: GameType, remarks: string, capacity: number): void {
        if (!name || name.trim() === '') {
            throw new Error('Game name cannot be empty.');
        }
        if (capacity < 1 || capacity > 99) {
            throw new Error('Capacity must be between 1 and 99.');
        }
        this._name = name;
        this._gameType = gameType;
        this._remarks = remarks;
        this._capacity = capacity;
    }

    // --- ゲッター (Getter) ---
    // カプセル化されたプロパティへの安全なアクセスを提供します。

    get name(): string { return this._name; }
    get gameType(): GameType { return this._gameType; }
    get remarks(): string { return this._remarks; }
    get capacity(): number { return this._capacity; }

    /**
     * 永続化やクライアントへの転送のために、エンティティをDTOに変換します。
     * @returns プレーンなゲーム情報オブジェクト (GameDto)
     */
    public toDto(): GameDto {
        return {
            id: this.id,
            name: this._name,
            gameType: this._gameType,
            remarks: this._remarks,
            capacity: this._capacity,
        };
    }
}
