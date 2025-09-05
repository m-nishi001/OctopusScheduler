import { injectable, inject } from "tsyringe";
import { IMovieRepository } from "../../../../domain/assets/movie/repository/movie-repository";
import { MovieMetadata } from "../../../../domain/assets/movie/vo/movie-metadata";

@injectable()
export class GetMovieMetadatasUseCase {
    constructor(@inject("IMovieRepository") private repository: IMovieRepository) { }

    execute(): MovieMetadata[] {
        return this.repository.findAllMetadatas();
    }
}
