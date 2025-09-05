import { injectable, inject } from "tsyringe";
import { IMovieRepository } from "../../../../domain/assets/movie/repository/movie-repository";
import { Movie } from "../../../../domain/assets/movie/entity/movie";
import { MovieId } from "../../../../domain/assets/movie/vo/movie-id";

@injectable()
export class GetMovieUseCase {
    constructor(@inject("IMovieRepository") private repository: IMovieRepository) { }

    execute(movieId: string): Movie | null {
        return this.repository.findById(new MovieId(movieId));
    }
}
