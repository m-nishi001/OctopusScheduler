import { inject, injectable } from "tsyringe";
import { GasService } from "../../gas-service";
import { IAudioRepository } from "../../../domain/assets/audio/repository/audio-repository";
import { IImageRepository } from "../../../domain/assets/image/repository/image-repository";
import { IMovieRepository } from "../../../domain/assets/movie/repository/movie-repository";

/**
 * アセット横断のメタデータを集約・検索するサービス
 */
@injectable()
export class AssetMetadataService implements GasService {
    readonly serviceName = "AssetMetadataService";
    readonly functions: Record<string, (args: any) => any>;

    private audioRepository: IAudioRepository;
    private imageRepository: IImageRepository;
    private movieRepository: IMovieRepository;

    constructor(
        @inject("IAudioRepository") audioRepository: IAudioRepository,
        @inject("IImageRepository") imageRepository: IImageRepository,
        @inject("IMovieRepository") movieRepository: IMovieRepository
    ) {
        this.audioRepository = audioRepository;
        this.imageRepository = imageRepository;
        this.movieRepository = movieRepository;
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
        const audios = this.audioRepository.findAllMetadatas().map(meta => ({
            id: meta.audioId,
            name: meta.audioName,
            type: "audio" as const,
            lastUpdatedAt: meta.lastUpdatedAt
        }));
        const images = this.imageRepository.findAllMetadatas().map(meta => ({
            id: meta.imageId,
            name: meta.imageName,
            type: "image" as const,
            lastUpdatedAt: meta.lastUpdatedAt
        }));
        const movies = this.movieRepository.findAllMetadatas().map(meta => ({
            id: meta.movieId,
            name: meta.movieName,
            type: "movie" as const,
            lastUpdatedAt: meta.lastUpdatedAt
        }));
        return [...audios, ...images, ...movies];
    }
}
