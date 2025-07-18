/**
 * @file ClientApi.ts
 * @description
 * クライアントから呼び出されるAPIの具体的な処理を実装します。
 * 各メソッドはCode.tsのディスパッチャ関数から呼び出されるファサードとして機能し、
 * 各ドメインのアプリケーションサービスへの処理の委譲を調整します。
 */

// --- 既存のサービス ---
import { MemberApplicationService, type AddMemberPayload, type UpdateMemberPayload } from '../domains/member/MemberApplicationService';
import type { MemberDto } from '../domains/member/Member';
import { ScreenSettingApplicationService } from '../domains/screen/ScreenSettingApplicationService';
import type { AssembledScreenSetting } from '../domains/screen/ScreenSetting';
import { AssetApplicationService, type UploadAssetPayload } from '../domains/asset/AssetApplicationService';
import type { AssetDto, AssetData } from '../domains/asset/Asset';
import { GameApplicationService, type AddGamePayload, type UpdateGamePayload } from '../domains/game/GameApplicationService';
import type { GameDto } from '../domains/game/Game';
import { VenueApplicationService, type AddVenuePayload, type UpdateVenuePayload } from '../domains/venue/VenueApplicationService';
import type { VenueDto } from '../domains/venue/Venue';
import { TeamApplicationService, type AddTeamPayload, type UpdateTeamPayload } from '../domains/team/TeamApplicationService';
import type { TeamDto } from '../domains/team/Team';
import { TimetableApplicationService, type SaveAllTimetablesPayload, type CurrentTurnInfoDto } from '../domains/timetable/TimetableApplicationService';
import type { TimetableDto } from '../domains/timetable/Timetable';
import { LotteryApplicationService } from '../domains/lottery/LotteryApplicationService';
import type { LotteryResult } from '../domains/lottery/LotteryDomainService';
import { ScoreApplicationService, type SaveScoresPayload } from '../domains/score/ScoreApplicationService';
import type { ScoreDto } from '../domains/score/Score';


// --- レスポンスの型定義 ---

type SuccessResponse<T> = {
    status: 'success';
    data: T;
};

type ErrorResponse = {
    status: 'error';
    message: string;
};

export type ApiResponse<T> = SuccessResponse<T> | ErrorResponse;

/**
 * 複数のアプリケーションサービスへのAPI呼び出しを束ねるファサードクラス。
 */
export class ClientApi {
    private readonly memberService: MemberApplicationService;
    private readonly screenSettingService: ScreenSettingApplicationService;
    private readonly assetService: AssetApplicationService;
    private readonly gameService: GameApplicationService;
    private readonly venueService: VenueApplicationService;
    private readonly teamService: TeamApplicationService;
    private readonly timetableService: TimetableApplicationService;
    private readonly lotteryService: LotteryApplicationService;
    private readonly scoreService: ScoreApplicationService; // ★ 新規追加

    constructor() {
        this.memberService = new MemberApplicationService();
        this.screenSettingService = new ScreenSettingApplicationService();
        this.assetService = new AssetApplicationService();
        this.gameService = new GameApplicationService();
        this.venueService = new VenueApplicationService();
        this.teamService = new TeamApplicationService();
        this.timetableService = new TimetableApplicationService();
        this.lotteryService = new LotteryApplicationService();
        this.scoreService = new ScoreApplicationService();
    }

    // --- プライベートヘルパー ---

    /**
     * サービスの呼び出しをラップし、成功/失敗レスポンスを生成する共通関数。
     * @param serviceCall 実行するサービスメソッドの呼び出し
     * @returns クライアントに返すApiResponse形式のオブジェクト
     */
    private handleServiceCall<T>(serviceCall: () => T): ApiResponse<T> {
        try {
            const result = serviceCall();
            return {
                status: 'success',
                data: result,
            };
        } catch (e) {
            const error = e as Error;
            console.error(`Error during service call: ${error.message}\n${error.stack}`);
            return {
                status: 'error',
                message: error.message,
            };
        }
    }

    // ===================================
    // --- Member API ---
    // ===================================
    public getMemberById(id: string): ApiResponse<MemberDto | null> {
        return this.handleServiceCall(() => this.memberService.getMemberById(id));
    }
    public getAllMembers(): ApiResponse<MemberDto[]> {
        return this.handleServiceCall(() => this.memberService.getAllMembers());
    }
    public addMember(payload: AddMemberPayload): ApiResponse<{ id: string; imageAssetName: string | null; }> {
        return this.handleServiceCall(() => this.memberService.addMember(payload));
    }
    public updateMember(payload: UpdateMemberPayload): ApiResponse<{ id: string; imageAssetName: string | null; }> {
        return this.handleServiceCall(() => this.memberService.updateMember(payload));
    }
    public deleteMember(id: string): ApiResponse<void> {
        return this.handleServiceCall(() => this.memberService.deleteMember(id));
    }

    // ===================================
    // --- Screen Setting API ---
    // ===================================
    public getScreenConfig(screenId: string): ApiResponse<AssembledScreenSetting> {
        return this.handleServiceCall(() => this.screenSettingService.getScreenConfig(screenId));
    }
    public saveScreenConfig(screenId: string, config: AssembledScreenSetting): ApiResponse<void> {
        return this.handleServiceCall(() => this.screenSettingService.saveScreenConfig(screenId, config));
    }

    // ===================================
    // --- Asset API ---
    // ===================================
    public getAssetList(): ApiResponse<AssetDto[]> {
        return this.handleServiceCall(() => this.assetService.getAssetList());
    }
    public getAssetBlobs(assetNames: string[]): ApiResponse<AssetData[]> {
        return this.handleServiceCall(() => this.assetService.getAssetBlobs(assetNames));
    }
    public uploadAsset(payload: UploadAssetPayload): ApiResponse<{ id: string; driveFileId: string; }> {
        return this.handleServiceCall(() => this.assetService.uploadAsset(payload));
    }
    public deleteAsset(assetId: string): ApiResponse<void> {
        return this.handleServiceCall(() => this.assetService.deleteAsset(assetId));
    }
    public findAssetUsage(assetNames: string[]): ApiResponse<Record<string, string[]>> {
        return this.handleServiceCall(() => this.screenSettingService.findAssetUsage(assetNames));
    }

    // ===================================
    // --- Game API  ---
    // ===================================
    public getGameById(id: string): ApiResponse<GameDto | null> {
        return this.handleServiceCall(() => this.gameService.getGameById(id));
    }
    public getAllGames(): ApiResponse<GameDto[]> {
        return this.handleServiceCall(() => this.gameService.getAllGames());
    }
    public addGame(payload: AddGamePayload): ApiResponse<GameDto> {
        return this.handleServiceCall(() => this.gameService.addGame(payload));
    }
    public updateGame(payload: UpdateGamePayload): ApiResponse<GameDto> {
        return this.handleServiceCall(() => this.gameService.updateGame(payload));
    }
    public deleteGame(id: string): ApiResponse<void> {
        return this.handleServiceCall(() => this.gameService.deleteGame(id));
    }

    // ===================================
    // --- Venue API  ---
    // ===================================
    public getVenueById(id: string): ApiResponse<VenueDto | null> {
        return this.handleServiceCall(() => this.venueService.getVenueById(id));
    }
    public getAllVenues(): ApiResponse<VenueDto[]> {
        return this.handleServiceCall(() => this.venueService.getAllVenues());
    }
    public addVenue(payload: AddVenuePayload): ApiResponse<VenueDto> {
        return this.handleServiceCall(() => this.venueService.addVenue(payload));
    }
    public updateVenue(payload: UpdateVenuePayload): ApiResponse<VenueDto> {
        return this.handleServiceCall(() => this.venueService.updateVenue(payload));
    }
    public deleteVenue(id: string): ApiResponse<void> {
        return this.handleServiceCall(() => this.venueService.deleteVenue(id));
    }

    // ===================================
    // --- Team API  ---
    // ===================================
    public getTeamById(id: string): ApiResponse<TeamDto | null> {
        return this.handleServiceCall(() => this.teamService.getTeamById(id));
    }
    public getAllTeams(): ApiResponse<TeamDto[]> {
        return this.handleServiceCall(() => this.teamService.getAllTeams());
    }
    public addTeam(payload: AddTeamPayload): ApiResponse<TeamDto> {
        return this.handleServiceCall(() => this.teamService.addTeam(payload));
    }
    public updateTeam(payload: UpdateTeamPayload): ApiResponse<TeamDto> {
        return this.handleServiceCall(() => this.teamService.updateTeam(payload));
    }
    public deleteTeam(id: string): ApiResponse<void> {
        return this.handleServiceCall(() => this.teamService.deleteTeam(id));
    }

    // ===================================
    // --- Timetable API  ---
    // ===================================
    public getAllTimetables(): ApiResponse<TimetableDto[]> {
        return this.handleServiceCall(() => this.timetableService.getAllTimetables());
    }
    public saveAllTimetables(payload: SaveAllTimetablesPayload): ApiResponse<TimetableDto[]> {
        return this.handleServiceCall(() => this.timetableService.saveAllTimetables(payload));
    }

    // ===================================
    // --- Lottery API  ---
    // ===================================
    public executeLottery(): ApiResponse<LotteryResult> {
        return this.handleServiceCall(() => this.lotteryService.executeLottery());
    }
    public getLastLotteryResult(): ApiResponse<LotteryResult | null> {
        return this.handleServiceCall(() => this.lotteryService.getLastLotteryResult());
    }

    // ===================================
    // --- Score & Turn API  ---
    // ===================================
    public getAllScores(): ApiResponse<ScoreDto[]> {
        return this.handleServiceCall(() => this.scoreService.getAllScores());
    }
    public saveScoresForTurn(turnNumber: number, payload: SaveScoresPayload): ApiResponse<ScoreDto[]> {
        return this.handleServiceCall(() => this.scoreService.saveScoresForTurn(turnNumber, payload));
    }
    public getCurrentTurnInfo(): ApiResponse<CurrentTurnInfoDto | null> {
        return this.handleServiceCall(() => this.timetableService.getCurrentTurnInfo());
    }
}
