import { injectable, inject } from "tsyringe";
import { IMovieRepository } from "../../../../domain/assets/movie/repository/movie-repository";
import { MovieId } from "../../../../domain/assets/movie/vo/movie-id";

@injectable()
export class RenameMovieUseCase {
    constructor(@inject("IMovieRepository") private repository: IMovieRepository) { }

    execute(movieId: string, newName: string): void {
        const movie = this.repository.findById(new MovieId(movieId));
        if (!movie) throw new Error(`Movie not found: ${movieId}`);
        movie.renameMovie(newName);
        this.repository.save(movie);
    }
}
