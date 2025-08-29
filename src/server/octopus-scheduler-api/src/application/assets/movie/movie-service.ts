import { inject, injectable } from "tsyringe";
import { GasService } from "../../gas-service";
import { IMovieRepository } from "../../../domain/assets/movie/repository/movie-repository";
import { MovieId } from "../../../domain/assets/movie/vo/movie-id";
import { Movie } from "../../../domain/assets/movie/entity/movie";

@injectable()
export class MovieService implements GasService {
    readonly serviceName = "MovieService";
    readonly functions: Record<string, (args: any) => any>;
    private repository: IMovieRepository;

    constructor(@inject("IMovieRepository") repository: IMovieRepository) {
        this.repository = repository;
        this.functions = {
            saveMovie: this.saveMovie.bind(this),
            getMovieMetadatas: this.getMovieMetadatas.bind(this),
            getMovie: this.getMovie.bind(this)
        };
    }

    private saveMovie(args: { movieId?: string, movieName: string, data64: string }): { movieId: string } {
        try {
            const blob = Utilities.newBlob(Utilities.base64Decode(args.data64), 'video/mp4', args.movieName);
            let movie: Movie;
            let movieId: string;
            if (args.movieId) {
                movie = Movie.fromEntity(new MovieId(args.movieId), args.movieName, blob);
                this.repository.save(movie);
                movieId = args.movieId;
            } else {
                movie = Movie.createNew(args.movieName, blob);
                this.repository.save(movie);
                movieId = movie.id.toString();
            }
            return { movieId };
        } catch (e) {
            Logger.log(`[MovieService.saveMovie] failed: ${e}`);
            throw e;
        }
    }

    /**
     * ムービーメタデータ一覧をJSオブジェクト配列で返却
     */
    private getMovieMetadatas(): Array<{ movieId: string; movieName: string; lastUpdatedAt: string }> {
        const movies: Movie[] = this.repository.findAll();
        return movies.map((m: Movie) => ({
            movieId: m.id.toString(),
            movieName: m.name,
            lastUpdatedAt: new Date().toISOString() // 必要に応じて修正
        }));
    }

    /**
     * ムービーデータをbase64文字列で返却
     */
    private getMovie(movieId: string): string | null {
        const movie: Movie | null = this.repository.findById(new MovieId(movieId));
        if (!movie) return null;
        const blob = movie.movieData;
        return Utilities.base64Encode(blob.getBytes());
    }
}
