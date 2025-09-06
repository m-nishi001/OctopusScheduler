import { inject, injectable } from "tsyringe";
import { GasService } from "../../gas-service";
import { SaveMovieUseCase } from "./usecases/save-movie-usecase";
import { GetMovieUseCase } from "./usecases/get-movie-usecase";
import { GetMovieMetadatasUseCase } from "./usecases/get-movie-metadatas-usecase";
import { RenameMovieUseCase } from "./usecases/rename-movie-usecase";
import { DeleteMovieUseCase } from "./usecases/delete-movie-usecase";

@injectable()
export class MovieService implements GasService {
    readonly serviceName = "MovieService";
    readonly functions: Record<string, (args: any) => any>;
    private saveMovieUseCase: SaveMovieUseCase;
    private getMovieUseCase: GetMovieUseCase;
    private getMovieMetadatasUseCase: GetMovieMetadatasUseCase;
    private renameMovieUseCase: RenameMovieUseCase;
    private deleteMovieUseCase: DeleteMovieUseCase;

    constructor(
        @inject(SaveMovieUseCase) saveMovieUseCase: SaveMovieUseCase,
        @inject(GetMovieUseCase) getMovieUseCase: GetMovieUseCase,
        @inject(GetMovieMetadatasUseCase) getMovieMetadatasUseCase: GetMovieMetadatasUseCase,
        @inject(RenameMovieUseCase) renameMovieUseCase: RenameMovieUseCase,
        @inject(DeleteMovieUseCase) deleteMovieUseCase: DeleteMovieUseCase
    ) {
        this.saveMovieUseCase = saveMovieUseCase;
        this.getMovieUseCase = getMovieUseCase;
        this.getMovieMetadatasUseCase = getMovieMetadatasUseCase;
        this.renameMovieUseCase = renameMovieUseCase;
        this.deleteMovieUseCase = deleteMovieUseCase;
        this.functions = {
            saveMovie: this.saveMovie.bind(this),
            getMovieMetadatas: this.getMovieMetadatas.bind(this),
            getMovie: this.getMovie.bind(this),
            renameMovie: this.renameMovie.bind(this),
            deleteMovie: this.deleteMovie.bind(this)
        };
    }

    private saveMovie(args: { movieId?: string, movieName: string, data64: string }): { movieId: string } {
        const blob = Utilities.newBlob(Utilities.base64Decode(args.data64), 'video/mp4', args.movieName);
        const movieId = this.saveMovieUseCase.execute({ movieId: args.movieId, movieName: args.movieName, data: blob });
        return { movieId };
    }

    private getMovieMetadatas(): Array<{ movieId: string; movieName: string; lastUpdatedAt: Date }> {
        const metas = this.getMovieMetadatasUseCase.execute();
        return metas.map(meta => ({ movieId: meta.movieId, movieName: meta.movieName, lastUpdatedAt: meta.lastUpdatedAt }));
    }

    private getMovie(movieId: string): { movieId: string; movieName: string; data64: string } | null {
        const movie = this.getMovieUseCase.execute(movieId);
        if (!movie) return null;
        const blob = movie.movieData;
        return {
            movieId: movie.id.toString(),
            movieName: movie.name,
            data64: Utilities.base64Encode(blob.getBytes())
        };
    }

    private renameMovie(args: { movieId: string; newName: string }): { movieId: string } {
        this.renameMovieUseCase.execute(args.movieId, args.newName);
        return { movieId: args.movieId };
    }

    private deleteMovie(movieId: string): { movieId: string } {
        this.deleteMovieUseCase.execute(movieId);
        return { movieId };
    }
}
