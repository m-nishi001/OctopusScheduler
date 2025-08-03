/**
 * @file LotteryDomainService.ts
 * @description
 * 抽選に関する複雑なビジネスロジックをカプセル化するドメインサービス。
 * このサービスはステートレスであり、特定のエンティティに属さない振る舞いを担当します。
 */

import type { Member, MemberDto } from '../member/Member';
import type { Team } from '../team/Team';
import type { Game, GameType } from '../game/Game';
import type { Venue } from '../venue/Venue';

// =================================================
// --- DTO (Data Transfer Object) ---
// =================================================

export interface TeamAssignmentResult {
    teamId: string;
    teamName: string;
    members: MemberDto[];
}

export interface MemberRoundAssignmentResult {
    roundNumber: number;
    memberId: string;
    memberNickname: string;
    memberPhotoAsset: string | null;
    teamId: string;
    gameId: string;
    gameName: string;
    gameType: GameType;
    venueId: string;
    venueName: string;
}

export interface LotteryResult {
    teamAssignments: TeamAssignmentResult[];
    roundAssignments: MemberRoundAssignmentResult[];
}

// =================================================
// --- ドメインサービスの本体 ---
// =================================================

export class LotteryDomainService {

    public executeLottery(
        members: Member[],
        teams: Team[],
        games: Game[],
        venues: Venue[],
        numRounds: number
    ): LotteryResult {
        this.validateInputs(members, teams, games, venues);

        const teamAssignments = this.assignMembersToTeams(members, teams);
        const venueGameMap = this.assignGamesToVenues(games, venues);
        const roundAssignments = this.assignMembersByRotation(
            numRounds,
            teamAssignments,
            [...venueGameMap.keys()],
            venueGameMap
        );

        return {
            teamAssignments: teamAssignments.map(ta => ({
                teamId: ta.team.id,
                teamName: ta.team.name,
                members: ta.members.map(m => m.toDto())
            })),
            roundAssignments: roundAssignments,
        };
    }

    private validateInputs(members: Member[], teams: Team[], games: Game[], venues: Venue[]): void {
        if (teams.length === 0 || games.length === 0 || venues.length === 0) {
            throw new Error('抽選の実行には、少なくとも1つ以上のチーム、ゲーム、会場が必要です。');
        }
        if (members.length < teams.length) {
            // Note: 新仕様では、各チームのメンバー数が会場数より少ない場合に空白が発生しうる
        }
        if (games.length !== venues.length) {
            throw new Error('ゲームの数と会場の数は一致している必要があります。');
        }
    }

    private shuffleArray<T>(array: T[]): T[] {
        const newArray = [...array];
        for (let i = newArray.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
        }
        return newArray;
    }

    private assignMembersToTeams(members: Member[], teams: Team[]): { team: Team, members: Member[] }[] {
        const shuffledMembers = this.shuffleArray(members);
        const assignments: { team: Team, members: Member[] }[] = teams.map(team => ({
            team,
            members: [],
        }));
        shuffledMembers.forEach((member, index) => {
            assignments[index % teams.length].members.push(member);
        });
        return assignments;
    }

    private assignGamesToVenues(games: Game[], venues: Venue[]): Map<Venue, Game> {
        const shuffledGames = this.shuffleArray(games);
        const map = new Map<Venue, Game>();
        venues.forEach((venue, index) => {
            map.set(venue, shuffledGames[index % shuffledGames.length]);
        });
        return map;
    }

    /**
     * 【新規実装】巡回（ラウンドロビン）方式でメンバーの割り当てを生成します。
     * @param numRounds 総ラウンド数
     * @param teamAssignments チーム分けの結果
     * @param venues 会場のリスト
     * @param venueGameMap 会場とゲームのマッピング
     * @returns 全てのラウンドの割り当て結果
     */
    private assignMembersByRotation(
        numRounds: number,
        teamAssignments: { team: Team; members: Member[] }[],
        venues: Venue[],
        venueGameMap: Map<Venue, Game>
    ): MemberRoundAssignmentResult[] {
        const finalAssignments: MemberRoundAssignmentResult[] = [];

        for (let roundNumber = 1; roundNumber <= numRounds; roundNumber++) {
            for (let teamIndex = 0; teamIndex < teamAssignments.length; teamIndex++) {
                const { team, members } = teamAssignments[teamIndex];

                // チームにメンバーがいなければ、そのチームの割り当てはスキップ
                if (members.length === 0) {
                    continue;
                }

                for (let venueIndex = 0; venueIndex < venues.length; venueIndex++) {
                    // この会場に、このチームからどのメンバーを割り当てるか決定する
                    // チーム内のメンバーを順番に選出するためのインデックス
                    const memberIndex = (roundNumber - 1 + venueIndex + teamIndex) % members.length;
                    const member = members[memberIndex];

                    const venue = venues[venueIndex];
                    const game = venueGameMap.get(venue)!;

                    finalAssignments.push({
                        roundNumber,
                        memberId: member.id,
                        memberNickname: member.nickname,
                        memberPhotoAsset: member.imageAssetName,
                        teamId: team.id,
                        gameId: game.id,
                        gameName: game.name,
                        gameType: game.gameType,
                        venueId: venue.id,
                        venueName: venue.name,
                    });
                }
            }
        }
        return finalAssignments;
    }
}
