/**
 * @file src/server/src/domains/lottery/LotteryResultRepository.ts
 * @description
 * 抽選結果の永続化をRepositoryServiceを介して行うリポジトリクラス。
 * TeamAssignmentEntityDto、MemberRoundAssignmentResultDtoの2つのシートを操作し、
 * 常に最新の抽選結果1件のみを保持する責務を持ちます。
 * DTOのインターフェース定義をこのファイル内に集約し、不要なlottery_runsシートへの依存を削除します。
 * また、メンバー情報の補完は本リポジトリの責務ではないため、MemberRepositoryへの依存を削除します。
 */

import { RepositoryService } from '../../repository/RepositoryService';
import type { ISerializable } from '../../repository/ISerializable';
import type { LotteryResult, TeamAssignmentResult, MemberRoundAssignmentResult } from './LotteryDomainService';
import type { GameType } from '../game/Game';

// --- DTOのインターフェース定義をこのファイル内に集約 ---

/**
 * 各抽選実行におけるチームへのメンバー割り当てDTO。
 * スプレッドシートの1行に対応します。
 */
export interface TeamAssignmentEntityDto extends ISerializable {
    /**
     * 各チーム割り当てを一意に識別するID (UUID)。
     * ISerializableインターフェースの要件を満たします。
     */
    id: string;

    /**
     * チームのID。
     */
    teamId: string;

    /**
     * チームの名称。
     * 可読性のため冗長化しています。
     */
    teamName: string;

    /**
     * このチームに割り当てられたメンバーのIDリスト（JSON文字列）。
     * 例: '["memberId1", "memberId2"]'
     */
    memberIdsJson: string;
}


/**
 * 各ラウンドにおけるメンバー割り当ての結果DTO。
 * スプレッドシートの1行に対応します。
 */
export interface MemberRoundAssignmentResultDto extends ISerializable {
    /**
     * 各割り当てを一意に識別するID (UUID)。
     * ISerializableインターフェースの要件を満たします。
     */
    id: string;

    /**
     * 割り当てが行われたラウンド番号。
     */
    roundNumber: number;

    /**
     * 割り当てられたメンバーのID。
     */
    memberId: string;

    /**
     * 割り当てられたチームのID。
     */
    teamId: string;

    /**
     * 割り当てられたゲームのID。
     */
    gameId: string;

    /**
     * 割り当てられたゲームの名前。
     * 可読性のため冗長化しています。
     */
    gameName: string;

    /**
     * 割り当てられたゲームの種別。
     * 可読性のため冗長化しています。
     */
    gameType: GameType;

    /**
     * 割り当てられた会場のID。
     */
    venueId: string;

    /**
     * 割り当てられた会場の名前。
     * 可読性のため冗長化しています。
     */
    venueName: string;
}

// 各シートの定義
const TEAM_ASSIGNMENTS_SHEET = 'team_assignments'; // チーム割り当てシート
const ROUND_ASSIGNMENTS_SHEET = 'round_assignments'; // ラウンド割り当てシート

/**
 * 抽選結果リポジトリクラス。
 * 本リポジトリは抽選結果の**永続化された形式**の読み書きのみを責務とし、
 * メンバー詳細情報（ニックネーム、画像アセットなど）の補完は行いません。
 * それらの補完はアプリケーションサービス（LotteryApplicationService）の責務です。
 */
export class LotteryResultRepository {
    private readonly teamAssignmentRepository: RepositoryService<TeamAssignmentEntityDto>;
    private readonly roundAssignmentRepository: RepositoryService<MemberRoundAssignmentResultDto>;

    constructor() {
        this.teamAssignmentRepository = new RepositoryService<TeamAssignmentEntityDto>(TEAM_ASSIGNMENTS_SHEET);
        this.roundAssignmentRepository = new RepositoryService<MemberRoundAssignmentResultDto>(ROUND_ASSIGNMENTS_SHEET);
    }

    /**
     * 最新の抽選結果を保存します。
     * 既存のすべてのチーム割り当てとラウンド割り当てを削除し、
     * 新しい結果のみを保存することで、常に最新の1件を保持します。
     * @param result - 保存するLotteryResultオブジェクト
     * @param _numRounds - この抽選で設定された総ラウンド数 (メタ情報が不要になったため、この引数は無視されますが、API互換性のため残します)
     */
    public saveLatestResult(result: LotteryResult, _numRounds: number): void {
        // 1. TeamAssignmentEntityDtoを生成し、既存のチーム割り当てをすべて置き換える
        const teamAssignmentDtos: TeamAssignmentEntityDto[] = result.teamAssignments.map(ta => ({
            id: Utilities.getUuid(),
            teamId: ta.teamId,
            teamName: ta.teamName,
            memberIdsJson: JSON.stringify(ta.members.map(m => m.id)),
        }));
        this.teamAssignmentRepository.replaceAll(teamAssignmentDtos);

        // 2. MemberRoundAssignmentResultDtoを生成し、既存の子レコードをすべて置き換える
        const roundAssignmentDtos: MemberRoundAssignmentResultDto[] = result.roundAssignments.map(ra => ({
            id: Utilities.getUuid(),
            roundNumber: ra.roundNumber,
            memberId: ra.memberId,
            teamId: ra.teamId,
            gameId: ra.gameId,
            gameName: ra.gameName,
            gameType: ra.gameType,
            venueId: ra.venueId,
            venueName: ra.venueName,
        }));
        this.roundAssignmentRepository.replaceAll(roundAssignmentDtos);
    }

    /**
     * 最新の抽選結果を取得します。
     * 本メソッドは永続化されたRAWデータを取得し、メンバーのニックネームや写真アセットといった
     * 詳細情報は含まれません。それらの補完は呼び出し元（アプリケーションサービス）の責務です。
     * @returns LotteryResultオブジェクト（メンバー詳細情報は補完されていない状態）、または結果がない場合はnull
     */
    public getLatestResult(): LotteryResult | null {
        const allTeamAssignments = this.teamAssignmentRepository.list();
        const allRoundAssignments = this.roundAssignmentRepository.list();

        // どちらかのシートにデータがあれば、抽選結果が存在するとみなす
        if (allTeamAssignments.length === 0 && allRoundAssignments.length === 0) {
            return null; // 抽選結果がまだ一度も保存されていない
        }

        // LotteryResultオブジェクトを再構築 (メンバー詳細情報はここでは補完しない)
        const teamAssignments: TeamAssignmentResult[] = allTeamAssignments.map(dto => {
            // JSON.parseする前に文字列をトリムし、確実に文字列であることを保証する
            const rawMemberIdsJson = dto.memberIdsJson;
            const safeMemberIdsJson = typeof rawMemberIdsJson === 'string'
                ? rawMemberIdsJson.trim()
                : JSON.stringify(rawMemberIdsJson); // オブジェクトなら強制的に文字列化

            // JSON.parseの前に、それが本当に文字列で、かつ空でないことを確認
            if (typeof safeMemberIdsJson !== 'string' || safeMemberIdsJson.length === 0) {
                // 不正なデータの場合はエラーをスロー
                throw new Error(`Invalid data type or empty string for memberIdsJson: '${safeMemberIdsJson}'`);
            }

            try {
                const memberIds: string[] = JSON.parse(safeMemberIdsJson);
                const members = memberIds.map(memberId => ({
                    id: memberId,
                    name: '',
                    nickname: '',
                    message: '',
                    imageAssetName: null
                }));
                return {
                    teamId: dto.teamId,
                    teamName: dto.teamName,
                    members: members,
                };
            } catch (e) {
                const error = e as Error;
                // パースエラーが発生した場合、詳細な情報とともにエラーをスロー
                throw new Error(`Team assignments data parse error: ${error.message} for value '${rawMemberIdsJson}'`);
            }
        });

        const roundAssignments: MemberRoundAssignmentResult[] = allRoundAssignments.map(dto => ({
            roundNumber: dto.roundNumber,
            memberId: dto.memberId,
            memberNickname: '',
            memberPhotoAsset: null,
            teamId: dto.teamId,
            gameId: dto.gameId,
            gameName: dto.gameName,
            gameType: dto.gameType,
            venueId: dto.venueId,
            venueName: dto.venueName,
        }));

        return {
            teamAssignments: teamAssignments,
            roundAssignments: roundAssignments,
        };
    }
}
