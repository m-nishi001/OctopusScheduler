/**
 * @file VenueApplicationService.ts
 * @description
 * 会場管理に関するユースケース（アプリケーションサービス）を実装します。
 * API層とドメイン層（エンティティ、リポジトリ）の間の調整役を担います。
 */

import { Venue, type VenueDto } from './Venue';
import { VenueRepository } from './VenueRepository';

// --- ペイロードの型定義 ---

/**
 * クライアントから `addVenue` 関数に渡されるデータの型定義。
 */
export type AddVenuePayload = {
    name: string;
    remarks: string;
    capacity: number;
};

/**
 * クライアントから `updateVenue` 関数に渡されるデータの型定義。
 * 更新対象を特定するための `id` を含みます。
 */
export type UpdateVenuePayload = {
    id: string;
    name: string;
    remarks: string;
    capacity: number;
};


/**
 * 会場に関するユースケースを実現するサービスクラス。
 */
export class VenueApplicationService {
    private readonly venueRepository: VenueRepository;

    constructor() {
        this.venueRepository = new VenueRepository();
    }

    /**
     * ユースケース: IDを指定して会場を1件取得します。
     * @param id - 取得する会場のID
     * @returns 会場情報DTO、またはnull
     */
    public getVenueById(id: string): VenueDto | null {
        const venue = this.venueRepository.findById(id);
        // 見つかった場合はDTOに変換して返し、見つからなければnullを返します。
        return venue ? venue.toDto() : null;
    }

    /**
     * ユースケース: 登録されている全ての会場を取得します。
     * @returns 会場情報DTOの配列
     */
    public getAllVenues(): VenueDto[] {
        const venues = this.venueRepository.findAll();
        // 取得したエンティティの配列をDTOの配列に変換します。
        return venues.map(venue => venue.toDto());
    }

    /**
     * ユースケース: 新しい会場を追加します。
     * @param payload - クライアントから渡された会場情報
     * @returns 作成された会場のDTO
     */
    public addVenue(payload: AddVenuePayload): VenueDto {
        // 1. Venueエンティティのファクトリメソッドを使い、ビジネスルールに基づいてインスタンスを生成します。
        const venue = Venue.create(
            payload.name,
            payload.remarks,
            payload.capacity
        );

        // 2. リポジトリに永続化を依頼します。
        this.venueRepository.save(venue);

        // 3. 採番されたIDを含むDTOをクライアントに返します。
        return venue.toDto();
    }

    /**
     * ユースケース: 会場情報を更新します。
     * @param payload - クライアントから渡された更新情報
     * @returns 更新された会場のDTO
     */
    public updateVenue(payload: UpdateVenuePayload): VenueDto {
        // 1. 更新対象のエンティティをリポジトリから取得します。
        const venue = this.venueRepository.findById(payload.id);
        if (!venue) {
            throw new Error(`Venue not found with id: ${payload.id}`);
        }

        // 2. エンティティの振る舞い（メソッド）を呼び出して状態を変更します。
        venue.updateDetails(
            payload.name,
            payload.remarks,
            payload.capacity
        );

        // 3. リポジトリに変更後のエンティティの永続化を依頼します。
        this.venueRepository.save(venue);

        // 4. 更新後のDTOをクライアントに返します。
        return venue.toDto();
    }

    /**
     * ユースケース: IDを指定して会場を削除します。
     * @param id - 削除する会場のID
     */
    public deleteVenue(id: string): void {
        // リポジトリに削除を依頼するだけです。
        this.venueRepository.delete(id);
    }
}
