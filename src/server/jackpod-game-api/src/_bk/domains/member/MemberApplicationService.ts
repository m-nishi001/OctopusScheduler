/**
 * @file MemberApplicationService.ts
 * @description メンバー管理に関するユースケース（アプリケーションサービス）を実装する。
 */

import { Member, MemberDto } from './Member';
import { MemberRepository } from './MemberRepository';
import { AssetApplicationService, UploadAssetPayload } from '../asset/AssetApplicationService';
import { AssetRepository } from '../asset/AssetRepository';


// --- ペイロードの型定義 ---

/**
 * クライアントからaddMember関数に渡されるデータの型
 */
export type AddMemberPayload = {
    name: string;
    nickname: string;
    message: string;
    imageData: string | null;      // Base64エンコードされた画像データ
    imageMimeType: string | null;
    imageName: string | null;
};

/**
 * クライアントからupdateMember関数に渡されるデータの型
 */
export type UpdateMemberPayload = {
    id: string;
    name: string;
    nickname: string;
    message: string;
    imageData: string | null;      // Base64エンコードされた画像データ
    imageMimeType: string | null;
    imageName: string | null;
};

/**
 * メンバーに関するユースケースを実現するサービスクラス。
 * ドメインとインフラストラクチャ層を操作し、一連の処理を調整する。
 */
export class MemberApplicationService {
    private readonly memberRepository: MemberRepository;
    // 【変更】ImageStorageServiceの代わりにAssetServiceとAssetRepositoryを保持
    private readonly assetService: AssetApplicationService;
    private readonly assetRepository: AssetRepository;

    constructor() {
        this.memberRepository = new MemberRepository();
        // 【変更】インスタンス化
        this.assetService = new AssetApplicationService();
        this.assetRepository = new AssetRepository();
    }

    /**
     * ユースケース：メンバーを1件取得する
     * @param id - 取得するメンバーのID
     * @returns メンバー情報DTO、またはnull
     */
    public getMemberById(id: string): MemberDto | null {
        const member = this.memberRepository.findById(id);
        return member ? member.toDto() : null;
    }

    /**
     * ユースケース：全メンバーを取得する
     * @returns メンバー情報DTOの配列
     */
    public getAllMembers(): MemberDto[] {
        const members = this.memberRepository.findAll();
        return members.map(member => member.toDto());
    }

    /**
     * ユースケース：新しいメンバーを追加する
     * @param payload - クライアントから渡されたメンバー情報
     * @returns 作成されたメンバーのIDと、画像アセット名
     */
    public addMember(payload: AddMemberPayload): { id: string, imageAssetName: string | null } {
        // 1. ドメインエンティティを生成
        const member = Member.create(payload.name, payload.nickname, payload.message);

        // 2. 画像データがあればアセットとして登録し、返されたアセット名をメンバーに設定
        if (payload.imageData && payload.imageMimeType && payload.imageName) {
            const assetPayload: UploadAssetPayload = {
                // アセット名が一意になるようにメンバーIDと元のファイル名を組み合わせる
                assetName: `member_${member.id}_${payload.imageName}`,
                assetType: 'image',
                base64Data: payload.imageData,
                mimeType: payload.imageMimeType,
                description: `Image for member: ${payload.name}`,
            };
            const newAsset = this.assetService.uploadAsset(assetPayload);
            member.imageAssetName = newAsset.name;
        }

        // 3. リポジトリに永続化を依頼
        this.memberRepository.save(member);

        // 4. クライアントに必要な情報を返す
        return {
            id: member.id,
            imageAssetName: member.imageAssetName,
        };
    }

    /**
     * ユースケース：メンバー情報を更新する
     * @param payload - クライアントから渡された更新情報
     * @returns 更新されたメンバーのIDと、画像アセット名
     */
    public updateMember(payload: UpdateMemberPayload): { id: string, imageAssetName: string | null } {
        // 1. 既存のドメインエンティティを取得
        const member = this.memberRepository.findById(payload.id);
        if (!member) {
            throw new Error(`Member not found with id: ${payload.id}`);
        }

        const oldAssetName = member.imageAssetName; // 更新前のアセット名を控えておく

        // 2. エンティティのテキスト情報を更新
        member.updateDetails(payload.name, payload.nickname, payload.message);

        // 3. 新しい画像データがあれば、古いアセットを削除し、新しいアセットを登録
        if (payload.imageData && payload.imageMimeType && payload.imageName) {
            // 新しい画像をアセットとして登録
            const assetPayload: UploadAssetPayload = {
                assetName: `member_${member.id}_${payload.imageName}`,
                assetType: 'image',
                base64Data: payload.imageData,
                mimeType: payload.imageMimeType,
                description: `Image for member: ${payload.name}`,
            };
            const newAsset = this.assetService.uploadAsset(assetPayload);
            member.imageAssetName = newAsset.name;

            // 古いアセットが存在すれば削除する
            if (oldAssetName) {
                // アセット名からアセットIDを検索して削除
                const oldAsset = this.assetRepository.findAll().find(a => a.name === oldAssetName);
                if (oldAsset) {
                    this.assetService.deleteAsset(oldAsset.id);
                }
            }
        }

        // 4. リポジトリに永続化を依頼
        this.memberRepository.save(member);

        // 5. クライアントに必要な情報を返す
        return {
            id: member.id,
            imageAssetName: member.imageAssetName,
        };
    }

    /**
     * ユースケース：メンバーを削除する
     * @param id - 削除するメンバーのID
     */
    public deleteMember(id: string): void {
        // 1. 削除前にメンバー情報を取得し、画像アセット名を把握する
        const member = this.memberRepository.findById(id);

        // 2. 画像アセットが紐付いていれば、アセットを削除
        if (member && member.imageAssetName) {
            const assetToDelete = this.assetRepository.findAll().find(a => a.name === member.imageAssetName);
            if (assetToDelete) {
                this.assetService.deleteAsset(assetToDelete.id);
            }
        }

        // 3. スプレッドシートからメンバー情報を削除
        this.memberRepository.delete(id);
    }
}
