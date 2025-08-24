import { injectable, inject } from "tsyringe";
import { GasService } from "../../gas-service";
import { IAudioRepository } from "../../../domain/assets/audio/repository/audio-repository";
import { Audio } from "../../../domain/assets/audio/entity/audio";
import { AudioMetadata } from "../../../domain/assets/audio/vo/audio-metadata";
import { AudioId } from "../../../domain/assets/audio/vo/audio-id";

/**
 * クライアントとやり取りするデータ構造を定義
 */
interface AudioDto {
    readonly audioId: string;
    readonly audioName: string;
    readonly data64: string;
}

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
     * @returns {AudioDto | null} オーディオファイルのデータ転送オブジェクト
     */
    private getAudio(fileId: string): AudioDto | null {
        const audioId = new AudioId(fileId);
        const audio = this.repository.findById(audioId);

        if (!audio) {
            return null;
        }

        // BlobデータをBase64エンコードしてクライアントに送る
        const base64Data = Utilities.base64Encode(audio.audioData.getBytes());

        return {
            audioId: audio.id.toString(),
            audioName: audio.name,
            data64: base64Data
        };
    }

    /**
     * クライアントから受け取ったオーディオファイルを保存する
     * @param {AudioDto} audioDto 保存するオーディオファイルのデータ転送オブジェクト
     */
    private saveAudio(audioDto: AudioDto): void {
        const data = Utilities.newBlob(Utilities.base64Decode(audioDto.data64));
        const audioId = new AudioId(audioDto.audioId);
        const audio = new Audio(audioId, audioDto.audioName, data);

        this.repository.save(audio);
    }
}