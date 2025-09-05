import { inject, injectable } from "tsyringe";
import { GasService } from "../../gas-service";
import { GetAudioMetadatasUseCase } from "../audio/usecases/get-audio-metadatas-usecase";
import { GetImageMetadatasUseCase } from "../image/usecases/get-image-metadatas-usecase";
import { GetMovieMetadatasUseCase } from "../movie/usecases/get-movie-metadatas-usecase";

/**
 * アセット横断のメタデータを集約・検索するサービス
 */
@injectable()
export class AssetMetadataService implements GasService {
    readonly serviceName = "AssetMetadataService";
    readonly functions: Record<string, (args: any) => any>;

    private getAudioMetadatasUseCase: GetAudioMetadatasUseCase;
    private getImageMetadatasUseCase: GetImageMetadatasUseCase;
    private getMovieMetadatasUseCase: GetMovieMetadatasUseCase;

    constructor(
        @inject(GetAudioMetadatasUseCase) getAudioMetadatasUseCase: GetAudioMetadatasUseCase,
        @inject(GetImageMetadatasUseCase) getImageMetadatasUseCase: GetImageMetadatasUseCase,
        @inject(GetMovieMetadatasUseCase) getMovieMetadatasUseCase: GetMovieMetadatasUseCase
    ) {
        this.getAudioMetadatasUseCase = getAudioMetadatasUseCase;
        this.getImageMetadatasUseCase = getImageMetadatasUseCase;
        this.getMovieMetadatasUseCase = getMovieMetadatasUseCase;
        this.functions = {
            getAllAssetMetadatas: this.getAllAssetMetadatas.bind(this)
        };
    }

    /**
     * 全アセットのメタデータを横断的に取得
     */
    private getAllAssetMetadatas(): Array<{
        id: string;
        name: string;
        type: "audio" | "image" | "movie";
        lastUpdatedAt: Date;
    }> {
    const audios = this.getAudioMetadatasUseCase.execute().map(meta => ({ id: meta.audioId, name: meta.audioName, type: "audio" as const, lastUpdatedAt: meta.lastUpdatedAt }));
    const images = this.getImageMetadatasUseCase.execute().map(meta => ({ id: meta.imageId, name: meta.imageName, type: "image" as const, lastUpdatedAt: meta.lastUpdatedAt }));
    const movies = this.getMovieMetadatasUseCase.execute().map(meta => ({ id: meta.movieId, name: meta.movieName, type: "movie" as const, lastUpdatedAt: meta.lastUpdatedAt }));
        return [...audios, ...images, ...movies];
    }
}
