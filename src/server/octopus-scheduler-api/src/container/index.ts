import { container } from "tsyringe";
import { GasService } from "../application/gas-service";
import { ScheduleService } from "../application/schedule/schedule-service";
import { ImageService } from "../application/assets/image/image-service";
import { MovieService } from "../application/assets/movie/movie-service";
import { AssetMetadataService } from "../application/assets/asset-management/asset-metadata-service";

import { IAudioRepository } from "../domain/assets/audio/repository/audio-repository";
import { AudioRepository } from "../infrastructures/assets/audio/audio-repository";

import { IImageRepository } from "../domain/assets/image/repository/image-repository";
import { ImageRepository } from "../infrastructures/assets/image/image-repository";
import { IMovieRepository } from "../domain/assets/movie/repository/movie-repository";
import { MovieRepository } from "../infrastructures/assets/movie/movie-repository";
import { IScheduleEventRepository } from "../domain/scheduler/schedule-event-reposiotry";
import { SpreadsheetScheduleEventRepository } from "../infrastructures/schedule/schedule-repository";
import { AudioApiService } from "../application/assets/audio/audio-api-service";

export class Container {
    static regiser() {
        container.register<GasService>("IGasService", { useClass: ScheduleService });
        container.register<GasService>("IGasService", { useClass: ImageService });
        container.register<GasService>("IGasService", { useClass: MovieService });
        container.register<GasService>("IGasService", { useClass: AudioApiService });
        container.register<GasService>("IGasService", { useClass: AssetMetadataService });
        container.register<IScheduleEventRepository>("IScheduleEventRepository", { useClass: SpreadsheetScheduleEventRepository });
        container.register<IAudioRepository>("IAudioRepository", { useClass: AudioRepository });
        container.register<IImageRepository>("IImageRepository", { useClass: ImageRepository });
        container.register<IMovieRepository>("IMovieRepository", { useClass: MovieRepository });
    }
}