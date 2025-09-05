import { Movie } from "../../../domains/assets/movie/entity/movie";
import type { IMovieRepository } from "../../../domains/assets/movie/repository/movie-repository";
import { MovieId } from "../../../domains/assets/movie/vo/movie-id";
import { MovieMetadata } from "../../../domains/assets/movie/vo/movie-metadata";
import { GasFunctionService } from "../../../../../packages/common-lib/src/google-apps-script/gas-script-service.ts";
import { LocalStorageService } from "../../../../../packages/common-lib/src/storage/local-storage-service.ts";
import { StorageConfig } from "../../storage-config";
import { AssetConverter } from "../asset-converter";

export class MovieRepository implements IMovieRepository {
    private readonly service;
    private readonly storage: LocalStorageService;
    private readonly movieStoreName = "MovieData";
    private readonly movieMetadataStoreName = "MovieMetadataStore";

    constructor() {
        const apiName = "callOctopusSchedulerApi";
        const service = GasFunctionService.create(apiName);
        if (!service) {
            throw new Error(`Failed to create GasFunctionService for API: ${apiName}`);
        }
        this.service = service;
        this.storage = new LocalStorageService(StorageConfig.getDbName(), this.movieStoreName);
    }

    public async save(movie: Movie): Promise<void> {
        try {
            await this.storage.save<Movie>(movie.id.toString(), movie);
            console.log(`Movie with ID ${movie.id.toString()} saved to local storage.`);

            const base64Data = await AssetConverter.blobToBase64(movie.movieData);
            const movieDataToSend = {
                movieId: movie.id.toString(),
                movieName: movie.name,
                data64: base64Data
            };
            await this.service
                .createCall<void>("MovieService.saveMovie", movieDataToSend)
                .withTimeout(20000)
                .withSuccessed(() => console.log(`Movie with ID ${movie.id.toString()} saved to remote.`))
                .withFailuered(message => {
                    console.error(`Failed to save movie to remote:`, message);
                    throw new Error("Failed to save movie to remote.");
                })
                .invoke();

        } catch (error) {
            console.error(`Failed to save movie with ID ${movie.id.toString()}:`, error);
            throw new Error("Failed to save movie.");
        }
    }

    public async findById(id: MovieId): Promise<Movie | null> {
        let movie = await this.storage.get<Movie>(id.toString());
        if (!movie) {
            console.log(`Movie with ID ${id.toString()} not found locally. Starting sync...`);
            await this.sync();
            movie = await this.storage.get<Movie>(id.toString());
            if (movie) {
                console.log(`Movie with ID ${id.toString()} found after sync.`);
            }
        }
        return movie ? Movie.reconstructFromObject(movie) : null;
    }

    public async findAll(): Promise<Movie[]> {
        let movies = await this.storage.getAll<Movie>();
        if (movies.size === 0) {
            console.log("No movies found locally. Starting sync...");
            await this.sync();
            movies = await this.storage.getAll<Movie>();
            if (movies.size > 0) {
                console.log(`${movies.size} movies found after sync.`);
            }
        }
        return Array.from(movies.values()).map(m => Movie.reconstructFromObject(m));
    }

    public async delete(id: MovieId): Promise<void> {
        try {
            await this.storage.delete(id.toString());
            console.log(`Movie with ID ${id.toString()} deleted successfully.`);
        } catch (error) {
            console.error(`Failed to delete movie with ID ${id.toString()}:`, error);
            throw new Error("Failed to delete movie.");
        }
    }

    public async sync(): Promise<void> {
        try {
            const remoteMetadatas = await this.getRemoteMetadatas();
            if (remoteMetadatas.length === 0) {
                console.log("No remote movie metadata found. Sync skipped.");
                return;
            }

            const localMetadatas = await this.getLocalMetadatas();
            const remoteMetadataMap = new Map<string, MovieMetadata>(remoteMetadatas.map(meta => [meta.movieId, meta]));
            const localMetadataMap = new Map<string, MovieMetadata>(Array.from(localMetadatas.values()).map(meta => [meta.movieId, meta]));

            await this.removeStaleFiles(remoteMetadataMap, localMetadataMap);
            await this.fetchAndUpdateFiles(remoteMetadatas, localMetadataMap);
        } catch (error) {
            console.error("An error occurred during sync:", error);
            throw new Error("Failed to sync movies.");
        }
    }

    private async getRemoteMetadatas(): Promise<MovieMetadata[]> {
        let remoteMetadatas = new Array<MovieMetadata>();
        const metadataCall = this.service.createCall<any>("MovieService.getMovieMetadatas");
        await metadataCall
            .withTimeout(20000)
            .withSuccessed(metadatas => {
                if (metadatas) {
                    remoteMetadatas = AssetConverter.normalizeMetadatas<MovieMetadata>(metadatas);
                }
            })
            .withFailuered(message => console.error("Failed to get remote movie metadata:", message))
            .invoke();
        return remoteMetadatas;
    }

    private async getLocalMetadatas(): Promise<Map<string, MovieMetadata>> {
        const localMetadataStorage = new LocalStorageService(StorageConfig.getDbName(), this.movieMetadataStoreName);
        return await localMetadataStorage.getAll<MovieMetadata>();
    }

    private async removeStaleFiles(
        remoteMetadataMap: Map<string, MovieMetadata>,
        localMetadataMap: Map<string, MovieMetadata>
    ): Promise<void> {
        const filesToRemove = Array.from(localMetadataMap.keys())
            .filter(fileId => !remoteMetadataMap.has(fileId));

        if (filesToRemove.length > 0) {
            console.log("Removing locally-deleted remote files:", filesToRemove);
            await this.storage.removeMultiple(filesToRemove);
            const localMetadataStorage = new LocalStorageService(StorageConfig.getDbName(), this.movieMetadataStoreName);
            await localMetadataStorage.removeMultiple(filesToRemove);
        }
    }

    private async fetchAndUpdateFiles(
        remoteMetadatas: MovieMetadata[],
        localMetadataMap: Map<string, MovieMetadata>
    ): Promise<void> {
        const filesToUpdate = remoteMetadatas.filter(remoteMeta => {
            const localMeta = localMetadataMap.get(remoteMeta.movieId);
            return !localMeta || localMeta.lastUpdatedAt < remoteMeta.lastUpdatedAt;
        });

        if (filesToUpdate.length > 0) {
            console.log("Found files to update:", filesToUpdate.map(f => f.movieId));
            const remoteMovies: Movie[] = [];

            const moviePromises = filesToUpdate.map(meta =>
                this.service
                    .createCall<any>("MovieService.getMovie", meta.movieId)
                    .withTimeout(20000)
                    .withSuccessed(base64Data => {
                        const data64 = AssetConverter.extractBase64Data(base64Data);
                        if (data64) {
                            const blobData = AssetConverter.base64ToBlob(data64, 'video/mp4');
                            const movie = Movie.reconstruct(meta.movieId, meta.movieName, blobData);
                            remoteMovies.push(movie);
                        } else {
                            console.warn(`MovieService.getMovie returned unexpected payload for id=${meta.movieId}`, base64Data);
                        }
                    })
            );

            await this.service.all(...moviePromises);

            const moviesToSave = new Map<string, Movie>(remoteMovies.map(movie => [movie.id.toString(), movie]));
            await this.storage.saveMultiple<Movie>(moviesToSave);

            const localMetadataStorage = new LocalStorageService(StorageConfig.getDbName(), this.movieMetadataStoreName);
            const metadatasToSave = new Map<string, MovieMetadata>(filesToUpdate.map(meta => [meta.movieId, meta]));
            await localMetadataStorage.saveMultiple<MovieMetadata>(metadatasToSave);

            console.log(`Successfully updated ${remoteMovies.length} movies and their metadata.`);
        } else {
            console.log("No movies to update. Local data is up-to-date.");
        }
    }
}