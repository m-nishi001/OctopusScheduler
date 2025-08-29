import type { MovieId } from "../vo/movie-id";
import { Movie } from "../entity/movie";

export interface IMovieRepository {
    save(movie: Movie): void;
    findById(id: MovieId): Movie | null;
    findAll(): Movie[];
    delete(id: MovieId): void;
}