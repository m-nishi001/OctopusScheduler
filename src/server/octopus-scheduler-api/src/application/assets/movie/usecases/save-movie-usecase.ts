import { injectable, inject } from "tsyringe";
import { IMovieRepository } from "../../../../domain/assets/movie/repository/movie-repository";
import { Movie } from "../../../../domain/assets/movie/entity/movie";
import { MovieId } from "../../../../domain/assets/movie/vo/movie-id";

@injectable()
export class SaveMovieUseCase {
    constructor(@inject("IMovieRepository") private repository: IMovieRepository) { }

    execute(args: { movieId?: string; movieName: string; data: GoogleAppsScript.Base.Blob }): string {
        if (args.movieId) {
            const movie = Movie.fromEntity(new MovieId(args.movieId), args.movieName, args.data);
            this.repository.save(movie);
            return args.movieId;
        }
        const movie = Movie.createNew(args.movieName, args.data);
        this.repository.save(movie);
        return movie.id.toString();
    }
}
