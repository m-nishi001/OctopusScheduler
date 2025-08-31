import type { MovieId } from "../vo/movie-id";
import { Movie } from "../entity/movie";

import { MovieMetadata } from "../vo/movie-metadata";

export interface IMovieRepository {
    save(movie: Movie): void;
    findById(id: MovieId): Movie | null;
    findAll(): Movie[];
    findAllMetadatas(): MovieMetadata[];
    delete(id: MovieId): void;
}