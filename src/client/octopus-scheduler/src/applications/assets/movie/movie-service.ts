import type { IMovieRepository } from "../../../domains/assets/movie/repository/movie-repository";
import { MovieRepository } from "../../../infrastructures/assets/movie/movie-repository";
import { SaveMovieUseCase } from "./usecase/save-movie-usecase";
import { GetMovieUseCase } from "./usecase/get-movie-usecase";
import { ListMoviesUseCase } from "./usecase/list-movies-usecase";
import { DeleteMovieUseCase } from "./usecase/delete-movie-usecase";
import { SyncMoviesUseCase } from "./usecase/sync-movies-usecase";
import { Movie } from "../../../domains/assets/movie/entity/movie";

export class MovieService {
    private readonly saveUc: SaveMovieUseCase;
    private readonly getUc: GetMovieUseCase;
    private readonly listUc: ListMoviesUseCase;
    private readonly deleteUc: DeleteMovieUseCase;
    private readonly syncUc: SyncMoviesUseCase;

    constructor(movieRepository?: IMovieRepository) {
        const repo = movieRepository ?? new MovieRepository();
        this.saveUc = new SaveMovieUseCase(repo);
        this.getUc = new GetMovieUseCase(repo);
        this.listUc = new ListMoviesUseCase(repo);
        this.deleteUc = new DeleteMovieUseCase(repo);
        this.syncUc = new SyncMoviesUseCase(repo);
    }

    public async saveNewMovie(movieName: string, data: Blob): Promise<void> {
        try {
            await this.saveUc.execute(movieName, data);
        } catch (error) {
            console.error("Failed to save new movie:", error);
            throw new Error("Failed to save new movie.");
        }
    }

    public async getMovieById(movieId: string): Promise<Movie | null> {
        try {
            return await this.getUc.execute(movieId);
        } catch (error) {
            console.error(`Failed to get movie with ID ${movieId}:`, error);
            return null;
        }
    }

    public async getAllMovies(): Promise<Movie[]> {
        try {
            return await this.listUc.execute();
        } catch (error) {
            console.error("Failed to get all movies:", error);
            return [];
        }
    }

    public async deleteMovie(movieId: string): Promise<void> {
        try {
            await this.deleteUc.execute(movieId);
        } catch (error) {
            console.error(`Failed to delete movie with ID ${movieId}:`, error);
            throw new Error("Failed to delete movie.");
        }
    }

    public async syncMovies(): Promise<void> {
        try {
            await this.syncUc.execute();
            console.log("Movies synchronized successfully.");
        } catch (error) {
            console.error("Failed to sync movies:", error);
            throw new Error("Failed to sync movies.");
        }
    }
}
