import type { IMovieRepository } from "../../../domains/assets/movie/repository/movie-repository";
import { MovieRepository } from "../../../infrastructures/assets/movie/movie-repository";
import { Movie } from "../../../domains/assets/movie/entity/movie";
import { MovieId } from "../../../domains/assets/movie/vo/movie-id";

export class MovieService {
    private readonly movieRepository: IMovieRepository;

    constructor(movieRepository?: IMovieRepository) {
        this.movieRepository = movieRepository ?? new MovieRepository();
    }

    public async saveNewMovie(movieName: string, data: Blob): Promise<void> {
        try {
            await this.movieRepository.save(Movie.create(movieName, data));
        } catch (error) {
            console.error("Failed to save new movie:", error);
            throw new Error("Failed to save new movie.");
        }
    }

    public async getMovieById(movieId: string): Promise<Movie | null> {
        try {
            return await this.movieRepository.findById(MovieId.create(movieId));
        } catch (error) {
            console.error(`Failed to get movie with ID ${movieId}:`, error);
            return null;
        }
    }

    public async getAllMovies(): Promise<Movie[]> {
        try {
            return await this.movieRepository.findAll();
        } catch (error) {
            console.error("Failed to get all movies:", error);
            return [];
        }
    }

    public async deleteMovie(movieId: string): Promise<void> {
        try {
            await this.movieRepository.delete(MovieId.create(movieId));
        } catch (error) {
            console.error(`Failed to delete movie with ID ${movieId}:`, error);
            throw new Error("Failed to delete movie.");
        }
    }

    public async syncMovies(): Promise<void> {
        try {
            await this.movieRepository.sync();
            console.log("Movies synchronized successfully.");
        } catch (error) {
            console.error("Failed to sync movies:", error);
            throw new Error("Failed to sync movies.");
        }
    }
}
