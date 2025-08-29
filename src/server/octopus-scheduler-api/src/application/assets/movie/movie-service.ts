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

    private async saveMovie(args: { movieId: string, movieName: string, data64: string }) {
        try {
            const blob = Utilities.newBlob(Utilities.base64Decode(args.data64), 'video/mp4', args.movieName);
            const movie = Movie.fromEntity(new MovieId(args.movieId), args.movieName, blob);
            await this.repository.save(movie);
            return { saved: true };
        } catch (e) {
            Logger.log(`[MovieService.saveMovie] failed: ${e}`);
            return { saved: false };
        }
    }

    private async getMovieMetadatas(): Promise<any[]> {
        const movies = await this.repository.findAll();
        return movies.map((m: Movie) => ({
            movieId: m.id.toString(),
            movieName: m.name,
            lastUpdatedAt: new Date().toISOString() // 必要に応じて修正
        }));
    }

    private async getMovie(movieId: string): Promise<string | null> {
        const movie = await this.repository.findById(new MovieId(movieId));
        if (!movie) return null;
        const blob = movie.movieData;
        return Utilities.base64Encode(blob.getBytes());
    }
}
