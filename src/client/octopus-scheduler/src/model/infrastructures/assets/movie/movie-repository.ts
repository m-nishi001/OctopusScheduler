import { Movie } from "../../../domains/assets/movie/entity/movie";
import type { IMovieRepository } from "../../../domains/assets/movie/repository/movie-repository";
import { MovieId } from "../../../domains/assets/movie/vo/movie-id";
import { MovieMetadata } from "../../../domains/assets/movie/vo/movie-metadata";
import { GasFunctionService } from "../../../../../../packages/common-lib/src/google-apps-script/gas-script-service.ts";
import { LocalStorageService } from "../../../../../../packages/common-lib/src/storage/local-storage-service.ts";
import { StorageConfig } from "../../storage-config.ts";
import { AssetConverter } from "../asset-converter.ts";

export class MovieRepository implements IMovieRepository {
    private readonly service;
    private readonly movieDataStorage: LocalStorageService;
    private readonly movieMetadataStorage: LocalStorageService;

    constructor() {
        const apiName = "callOctopusSchedulerApi";
        this.service = GasFunctionService.create(apiName)!;
        this.movieDataStorage = new LocalStorageService(StorageConfig.getDbName(), "MovieData");
        this.movieMetadataStorage = new LocalStorageService(StorageConfig.getDbName(), "MovieMetadataStore");
    }

    public async save(movie: Movie): Promise<void> {
        try {
            await this.movieDataStorage.save<Movie>(movie.movieId.toString(), movie);
            console.log(`Movie with ID ${movie.movieId.toString()} saved to local storage.`);

            const base64Data = await AssetConverter.blobToBase64(movie.movieData);
            const movieDataToSend = {
                movieId: movie.movieId.toString(),
                movieName: movie.movieName,
                data64: base64Data
            };
            await this.service
                .createCall<void>("MovieService.saveMovie", movieDataToSend)
                .withTimeout(20000)
                .withSuccessed(() => console.log(`Movie with ID ${movie.movieId.toString()} saved to remote.`))
                .withFailuered(message => {
                    console.error(`Failed to save movie to remote:`, message);
                    throw new Error("Failed to save movie to remote.");
                })
                .invoke();

        } catch (error) {
            console.error(`Failed to save movie with ID ${movie.movieId.toString()}:`, error);
            throw new Error("Failed to save movie.");
        }
    }

    public async findById(id: MovieId): Promise<Movie | null> {
        const movie = await this.movieDataStorage.get<Movie>(id.toString());
        return movie ? Movie.from(movie) : null;
    }

    public async findAll(): Promise<Movie[]> {
        const movies = await this.movieDataStorage.getAll<Movie>();
        return Array.from(movies.values()).map(m => Movie.from(m));
    }

    public async delete(id: MovieId): Promise<void> {
        try {
            // Request remote deletion first
            await this.service
                .createCall<void>("MovieService.deleteMovie", id.toString())
                .withTimeout(20000)
                .withSuccessed(() => console.log(`Movie with ID ${id.toString()} deleted on remote.`))
                .withFailuered(message => {
                    console.error(`Failed to delete movie on remote:`, message);
                    throw new Error("Failed to delete movie on remote.");
                })
                .invoke();

            // Remove local data and metadata
            await this.movieDataStorage.delete(id.toString());
            await this.movieMetadataStorage.delete(id.toString());
            console.log(`Movie with ID ${id.toString()} deleted successfully (remote + local).`);
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
            const localMovieMetadatas = Array.from(localMetadatas.values());

            await this.removeStaleFiles(remoteMetadatas, localMovieMetadatas);
            await this.fetchAndUpdateFiles(remoteMetadatas, localMovieMetadatas);
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
        return await this.movieMetadataStorage.getAll<MovieMetadata>();
    }

    private async removeStaleFiles(
        remoteMetadatas: MovieMetadata[],
        localMetadatas: MovieMetadata[]
    ): Promise<void> {
        const filesToRemove = localMetadatas
            .filter(localMeta => !remoteMetadatas.some(remoteMeta => remoteMeta.movieId === localMeta.movieId))
            .map(meta => meta.movieId);

        if (filesToRemove.length > 0) {
            console.log("Removing locally-deleted remote files:", filesToRemove);
            await this.movieDataStorage.removeMultiple(filesToRemove);
            await this.movieMetadataStorage.removeMultiple(filesToRemove);
        }
    }

    private async fetchAndUpdateFiles(
        remoteMetadatas: MovieMetadata[],
        localMetadatas: MovieMetadata[]
    ): Promise<void> {
        const filesToUpdate = remoteMetadatas.filter(remoteMeta => {
            const localMeta = localMetadatas.find(localMeta => localMeta.movieId === remoteMeta.movieId);
            return !localMeta || localMeta.lastUpdatedAt < remoteMeta.lastUpdatedAt;
        });

        if (filesToUpdate.length > 0) {
            console.log("Found files to update:", filesToUpdate.map(f => f.movieId));
            const remoteMovies: Movie[] = [];

            const moviePromises = filesToUpdate.map(meta =>
                this.service
                    .createCall<{ movieId: string; movieName: string; data64: string } | null>("MovieService.getMovie", meta.movieId)
                    .withTimeout(20000)
                    .withSuccessed(payload => {
                        if (payload) {
                            const blobData = AssetConverter.base64ToBlob(payload.data64, 'video/mp4');
                            const movie = Movie.create(payload.movieName, blobData, MovieId.create(payload.movieId));
                            remoteMovies.push(movie);
                        } else {
                            console.warn(`MovieService.getMovie returned unexpected payload for id=${meta.movieId}`, payload);
                        }
                    })
            );

            await this.service.all(...moviePromises);

            const moviesToSave = new Map<string, Movie>(remoteMovies.map(movie => [movie.movieId.toString(), movie]));
            await this.movieDataStorage.saveMultiple<Movie>(moviesToSave);

            const metadatasToSave = new Map<string, MovieMetadata>(filesToUpdate.map(meta => [meta.movieId, meta]));
            await this.movieMetadataStorage.saveMultiple<MovieMetadata>(metadatasToSave);

            console.log(`Successfully updated ${remoteMovies.length} movies and their metadata.`);
        } else {
            console.log("No movies to update. Local data is up-to-date.");
        }
    }
}