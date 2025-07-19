/**
 * @file GameApplicationService.ts
 * @description
 * ゲーム管理に関するユースケース（アプリケーションサービス）を実装します。
 * API層とドメイン層（エンティティ、リポジトリ）の間の調整役を担います。
 */

import { Game, type GameDto, type GameType } from './Game';
import { GameRepository } from './GameRepository';

// --- ペイロードの型定義 ---

/**
 * クライアントから `addGame` 関数に渡されるデータの型定義。
 * これにより、どのようなデータが必要かを明確にします。
 */
export type AddGamePayload = {
    name: string;
    gameType: GameType;
    remarks: string;
    capacity: number;
};

/**
 * クライアントから `updateGame` 関数に渡されるデータの型定義。
 * 更新対象を特定するための `id` を含みます。
 */
export type UpdateGamePayload = {
    id: string;
    name: string;
    gameType: GameType;
    remarks: string;
    capacity: number;
};


/**
 * ゲームに関するユースケースを実現するサービスクラス。
 */
export class GameApplicationService {
    private readonly gameRepository: GameRepository;

    constructor() {
        this.gameRepository = new GameRepository();
    }

    /**
     * ユースケース: IDを指定してゲームを1件取得します。
     * @param id - 取得するゲームのID
     * @returns ゲーム情報DTO、またはnull
     */
    public getGameById(id: string): GameDto | null {
        const game = this.gameRepository.findById(id);
        // 見つかった場合はDTOに変換して返し、見つからなければnullを返します。
        return game ? game.toDto() : null;
    }

    /**
     * ユースケース: 登録されている全てのゲームを取得します。
     * @returns ゲーム情報DTOの配列
     */
    public getAllGames(): GameDto[] {
        const games = this.gameRepository.findAll();
        // 取得したエンティティの配列をDTOの配列に変換します。
        return games.map(game => game.toDto());
    }

    /**
     * ユースケース: 新しいゲームを追加します。
     * @param payload - クライアントから渡されたゲーム情報
     * @returns 作成されたゲームのDTO
     */
    public addGame(payload: AddGamePayload): GameDto {
        // 1. Gameエンティティのファクトリメソッドを使い、ビジネスルールに基づいてインスタンスを生成します。
        const game = Game.create(
            payload.name,
            payload.gameType,
            payload.remarks,
            payload.capacity
        );

        // 2. リポジトリに永続化を依頼します。
        this.gameRepository.save(game);

        // 3. 採番されたIDを含むDTOをクライアントに返します。
        return game.toDto();
    }

    /**
     * ユースケース: ゲーム情報を更新します。
     * @param payload - クライアントから渡された更新情報
     * @returns 更新されたゲームのDTO
     */
    public updateGame(payload: UpdateGamePayload): GameDto {
        // 1. 更新対象のエンティティをリポジトリから取得します。
        const game = this.gameRepository.findById(payload.id);
        if (!game) {
            throw new Error(`Game not found with id: ${payload.id}`);
        }

        // 2. エンティティの振る舞い（メソッド）を呼び出して状態を変更します。
        game.updateDetails(
            payload.name,
            payload.gameType,
            payload.remarks,
            payload.capacity
        );

        // 3. リポジトリに変更後のエンティティの永続化を依頼します。
        this.gameRepository.save(game);

        // 4. 更新後のDTOをクライアントに返します。
        return game.toDto();
    }

    /**
     * ユースケース: IDを指定してゲームを削除します。
     * @param id - 削除するゲームのID
     */
    public deleteGame(id: string): void {
        // リポジトリに削除を依頼するだけです。
        this.gameRepository.delete(id);
    }
}
