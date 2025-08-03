/**
 * @file LotteryApplicationService.ts
 * @description
 * 抽選の実行というユースケースを実装するアプリケーションサービス。
 * データ（エンティティ）の取得と、ドメインサービスへの処理の委譲を調整します。
 */

import { MemberRepository } from '../member/MemberRepository';
import { TeamRepository } from '../team/TeamRepository';
import { GameRepository } from '../game/GameRepository';
import { VenueRepository } from '../venue/VenueRepository';
import { LotteryDomainService, type LotteryResult, type TeamAssignmentResult, type MemberRoundAssignmentResult } from './LotteryDomainService';
import { TimetableApplicationService } from '../timetable/TimetableApplicationService';
import { LotteryResultRepository } from './LotteryResultRepository';

/**
 * 抽選に関するユースケースを実現するサービスクラス。
 */
export class LotteryApplicationService {
    private readonly memberRepository: MemberRepository;
    private readonly teamRepository: TeamRepository;
    private readonly gameRepository: GameRepository;
    private readonly venueRepository: VenueRepository;
    private readonly lotteryDomainService: LotteryDomainService;
    private readonly timetableApplicationService: TimetableApplicationService;
    private readonly lotteryResultRepository: LotteryResultRepository;

    constructor() {
        this.memberRepository = new MemberRepository();
        this.teamRepository = new TeamRepository();
        this.gameRepository = new GameRepository();
        this.venueRepository = new VenueRepository();
        this.lotteryDomainService = new LotteryDomainService();
        this.timetableApplicationService = new TimetableApplicationService();
        this.lotteryResultRepository = new LotteryResultRepository();
    }

    /**
     * ユースケース: 抽選を実行し、チーム分けとゲーム割り当ての結果を生成します。
     * @returns 抽選結果オブジェクト
     */
    public executeLottery(): LotteryResult {
        const maxTurnCount = this.timetableApplicationService.getMaxTurnCount();
        const result = this.lotteryDomainService.executeLottery(
            this.memberRepository.findAll(),
            this.teamRepository.findAll(),
            this.gameRepository.findAll(),
            this.venueRepository.findAll(),
            maxTurnCount
        );

        // 結果を保存
        this.lotteryResultRepository.saveLatestResult(result, maxTurnCount);

        return result;
    }

    /**
     * ユースケース: 前回の抽選結果を取得する
     * 本メソッドが、LotteryResultRepositoryから取得した結果にメンバー詳細情報を補完する責務を負います。
     * @returns LotteryResultオブジェクト、または結果がない場合はnull
     */
    public getLastLotteryResult(): LotteryResult | null {
        try {
            const rawResult = this.lotteryResultRepository.getLatestResult();
            if (!rawResult) {
                return null;
            }

            // MemberDtoを再構築するために全メンバー情報を取得
            const allMembers = this.memberRepository.findAll();
            const memberMap = new Map(allMembers.map(m => [m.id, m]));

            // TeamAssignmentsのメンバー詳細情報を補完
            const teamAssignments: TeamAssignmentResult[] = rawResult.teamAssignments.map(ta => {
                const members = ta.members.map(m => {
                    const fullMember = memberMap.get(m.id);
                    // MemberDtoをtoDto()で再構築して返す
                    return fullMember ? fullMember.toDto() : { id: m.id, name: '不明メンバー', nickname: '不明', message: '', imageAssetName: null };
                });
                return {
                    teamId: ta.teamId,
                    teamName: ta.teamName,
                    members: members,
                };
            });

            // RoundAssignmentsのメンバーニックネームと写真アセットを補完
            const roundAssignments: MemberRoundAssignmentResult[] = rawResult.roundAssignments.map(ra => {
                const member = memberMap.get(ra.memberId);
                return {
                    roundNumber: ra.roundNumber,
                    memberId: ra.memberId,
                    memberNickname: member ? member.nickname : '不明',
                    memberPhotoAsset: member ? member.imageAssetName : null,
                    teamId: ra.teamId,
                    gameId: ra.gameId,
                    gameName: ra.gameName,
                    gameType: ra.gameType,
                    venueId: ra.venueId,
                    venueName: ra.venueName,
                };
            });

            return {
                teamAssignments: teamAssignments,
                roundAssignments: roundAssignments,
            };

        } catch (e) {
            const error = e as Error;
            Logger.log("getLastLotteryResult: 実行時エラーが発生しました。エラーメッセージ: %s, スタックトレース: %s", error.message, error.stack);
            throw new Error("最新の抽選結果の取得とメンバー情報の補完に失敗しました。詳細: " + error.message);
        }
    }
}
