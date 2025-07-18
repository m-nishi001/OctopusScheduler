/**
 * @file TeamApplicationService.ts
 * @description
 * チーム管理に関するユースケース（アプリケーションサービス）を実装します。
 * API層とドメイン層（エンティティ、リポジトリ）の間の調整役を担います。
 */

import { Team, type TeamDto } from './Team';
import { TeamRepository } from './TeamRepository';

// --- ペイロードの型定義 ---

/**
 * クライアントから `addTeam` 関数に渡されるデータの型定義。
 */
export type AddTeamPayload = {
    name: string;
    remarks: string;
    capacity: number;
};

/**
 * クライアントから `updateTeam` 関数に渡されるデータの型定義。
 * 更新対象を特定するための `id` を含みます。
 */
export type UpdateTeamPayload = {
    id: string;
    name: string;
    remarks: string;
    capacity: number;
};


/**
 * チームに関するユースケースを実現するサービスクラス。
 */
export class TeamApplicationService {
    private readonly teamRepository: TeamRepository;

    constructor() {
        this.teamRepository = new TeamRepository();
    }

    /**
     * ユースケース: IDを指定してチームを1件取得します。
     * @param id - 取得するチームのID
     * @returns チーム情報DTO、またはnull
     */
    public getTeamById(id: string): TeamDto | null {
        const team = this.teamRepository.findById(id);
        // 見つかった場合はDTOに変換して返し、見つからなければnullを返します。
        return team ? team.toDto() : null;
    }

    /**
     * ユースケース: 登録されている全てのチームを取得します。
     * @returns チーム情報DTOの配列
     */
    public getAllTeams(): TeamDto[] {
        const teams = this.teamRepository.findAll();
        // 取得したエンティティの配列をDTOの配列に変換します。
        return teams.map(team => team.toDto());
    }

    /**
     * ユースケース: 新しいチームを追加します。
     * @param payload - クライアントから渡されたチーム情報
     * @returns 作成されたチームのDTO
     */
    public addTeam(payload: AddTeamPayload): TeamDto {
        // 1. Teamエンティティのファクトリメソッドを使い、ビジネスルールに基づいてインスタンスを生成します。
        const team = Team.create(
            payload.name,
            payload.remarks,
            payload.capacity
        );

        // 2. リポジトリに永続化を依頼します。
        this.teamRepository.save(team);

        // 3. 採番されたIDを含むDTOをクライアントに返します。
        return team.toDto();
    }

    /**
     * ユースケース: チーム情報を更新します。
     * @param payload - クライアントから渡された更新情報
     * @returns 更新されたチームのDTO
     */
    public updateTeam(payload: UpdateTeamPayload): TeamDto {
        // 1. 更新対象のエンティティをリポジトリから取得します。
        const team = this.teamRepository.findById(payload.id);
        if (!team) {
            throw new Error(`Team not found with id: ${payload.id}`);
        }

        // 2. エンティティの振る舞い（メソッド）を呼び出して状態を変更します。
        team.updateDetails(
            payload.name,
            payload.remarks,
            payload.capacity
        );

        // 3. リポジトリに変更後のエンティティの永続化を依頼します。
        this.teamRepository.save(team);

        // 4. 更新後のDTOをクライアントに返します。
        return team.toDto();
    }

    /**
     * ユースケース: IDを指定してチームを削除します。
     * @param id - 削除するチームのID
     */
    public deleteTeam(id: string): void {
        // リポジトリに削除を依頼するだけです。
        this.teamRepository.delete(id);
    }
}
