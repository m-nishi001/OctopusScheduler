import { container } from "tsyringe";
import { GasService } from "../application/gas-service";
import { ScheduleService } from "../application/schedule/schedule-service";
import { ImageService } from "../application/assets/image/image-service";
import { MovieService } from "../application/assets/movie/movie-service";
import { AssetMetadataService } from "../application/assets/asset-management/asset-metadata-service";
import { SaveImageUseCase } from "../application/assets/image/usecases/save-image-usecase";
import { GetImageUseCase } from "../application/assets/image/usecases/get-image-usecase";
import { GetImageMetadatasUseCase } from "../application/assets/image/usecases/get-image-metadatas-usecase";
import { RenameImageUseCase } from "../application/assets/image/usecases/rename-image-usecase";
import { SaveMovieUseCase } from "../application/assets/movie/usecases/save-movie-usecase";
import { GetMovieUseCase } from "../application/assets/movie/usecases/get-movie-usecase";
import { GetMovieMetadatasUseCase } from "../application/assets/movie/usecases/get-movie-metadatas-usecase";
import { RenameMovieUseCase } from "../application/assets/movie/usecases/rename-movie-usecase";
import { SaveAudioUseCase } from "../application/assets/audio/usecases/save-audio-usecase";
import { GetAudioUseCase } from "../application/assets/audio/usecases/get-audio-usecase";
import { GetAudioMetadatasUseCase } from "../application/assets/audio/usecases/get-audio-metadatas-usecase";
import { RenameAudioUseCase } from "../application/assets/audio/usecases/rename-audio-usecase";

import { IAudioRepository } from "../domain/assets/audio/repository/audio-repository";
import { AudioRepository } from "../infrastructures/assets/audio/audio-repository";

import { IImageRepository } from "../domain/assets/image/repository/image-repository";
import { ImageRepository } from "../infrastructures/assets/image/image-repository";
import { IMovieRepository } from "../domain/assets/movie/repository/movie-repository";
import { MovieRepository } from "../infrastructures/assets/movie/movie-repository";
import { IScheduleEventRepository } from "../domain/schedule/schedule-event-reposiotry";
import { SpreadsheetScheduleEventRepository } from "../infrastructures/schedule/schedule-repository";
import { AudioApiService } from "../application/assets/audio/audio-api-service";

export class Container {
    static regiser() {
        container.register<GasService>("IGasService", { useClass: ScheduleService });
        container.register<GasService>("IGasService", { useClass: ImageService });
        container.register<GasService>("IGasService", { useClass: MovieService });
        container.register<GasService>("IGasService", { useClass: AudioApiService });
        container.register<GasService>("IGasService", { useClass: AssetMetadataService });

        // register asset use cases
        container.register(SaveImageUseCase, { useClass: SaveImageUseCase });
        container.register(GetImageUseCase, { useClass: GetImageUseCase });
        container.register(GetImageMetadatasUseCase, { useClass: GetImageMetadatasUseCase });
        container.register(RenameImageUseCase, { useClass: RenameImageUseCase });

        container.register(SaveMovieUseCase, { useClass: SaveMovieUseCase });
        container.register(GetMovieUseCase, { useClass: GetMovieUseCase });
        container.register(GetMovieMetadatasUseCase, { useClass: GetMovieMetadatasUseCase });
        container.register(RenameMovieUseCase, { useClass: RenameMovieUseCase });

        container.register(SaveAudioUseCase, { useClass: SaveAudioUseCase });
        container.register(GetAudioUseCase, { useClass: GetAudioUseCase });
        container.register(GetAudioMetadatasUseCase, { useClass: GetAudioMetadatasUseCase });
        container.register(RenameAudioUseCase, { useClass: RenameAudioUseCase });
        container.register<IScheduleEventRepository>("IScheduleEventRepository", { useClass: SpreadsheetScheduleEventRepository });
        container.register<IAudioRepository>("IAudioRepository", { useClass: AudioRepository });
        container.register<IImageRepository>("IImageRepository", { useClass: ImageRepository });
        container.register<IMovieRepository>("IMovieRepository", { useClass: MovieRepository });
    }
}