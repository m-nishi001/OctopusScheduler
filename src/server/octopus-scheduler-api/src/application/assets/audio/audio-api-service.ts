import { injectable, inject } from "tsyringe";
import { GasService } from "../../gas-service";
import { SaveAudioUseCase } from "./usecases/save-audio-usecase";
import { GetAudioUseCase } from "./usecases/get-audio-usecase";
import { GetAudioMetadatasUseCase } from "./usecases/get-audio-metadatas-usecase";
import { RenameAudioUseCase } from "./usecases/rename-audio-usecase";
import { DeleteAudioUseCase } from "./usecases/delete-audio-usecase";
import { AudioMetadata } from "../../../domain/assets/audio/vo/audio-metadata";

// Google Apps Script Utilities型の型エラー抑制
declare const Utilities: any;

/**
 * クライアントとやり取りするデータ構造を定義
 */


@injectable()
export class AudioApiService implements GasService {
    public readonly serviceName: string = "AudioService";
    public readonly functions: Record<string, (args: any) => any>;

    private saveAudioUseCase: SaveAudioUseCase;
    private getAudioUseCase: GetAudioUseCase;
    private getAudioMetadatasUseCase: GetAudioMetadatasUseCase;
    private renameAudioUseCase: RenameAudioUseCase;
    private deleteAudioUseCase: DeleteAudioUseCase;

    constructor(
        @inject(SaveAudioUseCase) saveAudioUseCase: SaveAudioUseCase,
        @inject(GetAudioUseCase) getAudioUseCase: GetAudioUseCase,
        @inject(GetAudioMetadatasUseCase) getAudioMetadatasUseCase: GetAudioMetadatasUseCase,
        @inject(RenameAudioUseCase) renameAudioUseCase: RenameAudioUseCase
        , @inject(DeleteAudioUseCase) deleteAudioUseCase: DeleteAudioUseCase
    ) {
        this.saveAudioUseCase = saveAudioUseCase;
        this.getAudioUseCase = getAudioUseCase;
        this.getAudioMetadatasUseCase = getAudioMetadatasUseCase;
        this.renameAudioUseCase = renameAudioUseCase;
        this.deleteAudioUseCase = deleteAudioUseCase;
        this.functions = {
            "getAudioMetadatas": this.getAudioMetadatas.bind(this),
            "getAudio": this.getAudio.bind(this),
            "saveAudio": this.saveAudio.bind(this),
            "renameAudio": this.renameAudio.bind(this),
            "deleteAudio": this.deleteAudio.bind(this)
        };
    }

    /**
     * Google Driveに保存されているオーディオファイルのメタデータを取得する
     * @returns {AudioMetadata[]} オーディオファイルメタデータの配列
     */
    private getAudioMetadatas(): AudioMetadata[] {
        return this.getAudioMetadatasUseCase.execute();
    }

    /**
     * 特定のオーディオファイルの内容を取得する
     * @param {string} fileId 取得するファイルのID
     * @returns {object | null} オーディオファイルのデータ転送オブジェクト
     */
    private getAudio(fileId: string): { audioId: string; audioName: string; data64: string } | null {
        const audio = this.getAudioUseCase.execute(fileId);
        if (!audio) {
            Logger.log(`Audio with ID ${fileId} not found.`);
            return null;
        }
        const bytes = (audio.audioData.getBytes) ? audio.audioData.getBytes() : [];
        const base64Data = Utilities.base64Encode(bytes);
        return {
            audioId: audio.id.toString(),
            audioName: audio.name,
            data64: base64Data
        };
    }

    /**
     * クライアントから受け取ったオーディオファイルを保存する
     * @param {object} args 保存するオーディオファイルのデータ
     */
    private saveAudio(args: { audioId?: string, audioName: string, data64: string }): { audioId: string } {
        const data = Utilities.newBlob(Utilities.base64Decode(args.data64));
        const audioId = this.saveAudioUseCase.execute({ audioId: args.audioId, audioName: args.audioName, data });
        return { audioId };
    }

    private renameAudio(args: { audioId: string; newName: string }): { audioId: string } {
        this.renameAudioUseCase.execute(args.audioId, args.newName);
        return { audioId: args.audioId };
    }

    private deleteAudio(audioId: string): { audioId: string } {
        this.deleteAudioUseCase.execute(audioId);
        return { audioId };
    }
}