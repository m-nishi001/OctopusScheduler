import { injectable, inject } from "tsyringe";
import { GasService } from "../../gas-service";
import { IAudioRepository } from "../../../domain/assets/audio/repository/audio-repository";
import { Audio } from "../../../domain/assets/audio/entity/audio";
import { AudioMetadata } from "../../../domain/assets/audio/vo/audio-metadata";
import { AudioId } from "../../../domain/assets/audio/vo/audio-id";

// Google Apps Script Utilities型の型エラー抑制
declare const Utilities: any;

/**
 * クライアントとやり取りするデータ構造を定義
 */


@injectable()
export class AudioApiService implements GasService {
    public readonly serviceName: string = "AudioService";
    public readonly functions: Record<string, (args: any) => any>;

    private repository: IAudioRepository;

    constructor(@inject("IAudioRepository") repository: IAudioRepository) {
        this.repository = repository;
        this.functions = {
            "getAudioMetadatas": this.getAudioMetadatas.bind(this),
            "getAudio": this.getAudio.bind(this),
            "saveAudio": this.saveAudio.bind(this)
        };
    }

    /**
     * Google Driveに保存されているオーディオファイルのメタデータを取得する
     * @returns {AudioMetadata[]} オーディオファイルメタデータの配列
     */
    private getAudioMetadatas(): AudioMetadata[] {
        return this.repository.findAllMetadatas();
    }

    /**
     * 特定のオーディオファイルの内容を取得する
     * @param {string} fileId 取得するファイルのID
     * @returns {object | null} オーディオファイルのデータ転送オブジェクト
     */
    private getAudio(fileId: string): { audioId: string; audioName: string; data64: string } | null {
        const audioId = new AudioId(fileId);
        const audio = this.repository.findById(audioId);

        if (!audio) {
            Logger.log(`Audio with ID ${fileId} not found.`);
            return null;
        }

        // BlobデータをBase64エンコードしてクライアントに送る
        // GoogleAppsScript.Base.BlobにはgetBytes()がないため、getBytes()ラッパーを利用
        const bytes = (audio.audioData.getBytes) ? audio.audioData.getBytes() : [];
        const base64Data = Utilities.base64Encode(bytes);

        Logger.log(`bytes: ${bytes && bytes.length ? bytes.length : 0}`);
        Logger.log(`base64Data: ${base64Data ? base64Data.substring(0, 30) + '...' : 'undefined'}`);

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
        let audio: Audio;
        let audioId: string;

        if (args.audioId) {
            // 更新
            audio = new Audio(new AudioId(args.audioId), args.audioName, data);
            this.repository.save(audio);
            audioId = args.audioId;
        } else {
            // 新規
            audio = Audio.createNew(args.audioName, data);
            this.repository.save(audio);
            audioId = audio.id.toString();
        }
        return { audioId };
    }
}