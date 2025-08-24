import type { MovieId } from "../vo/movie-id";
import { Movie } from "../entity/movie";

export interface IMovieRepository {
    save(movie: Movie): Promise<void>;
    findById(id: MovieId): Promise<Movie | null>;
    findAll(): Promise<Movie[]>;
    delete(id: MovieId): Promise<void>;
    sync(): Promise<void>;
}