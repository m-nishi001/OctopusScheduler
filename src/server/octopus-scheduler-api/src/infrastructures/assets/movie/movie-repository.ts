import { Movie } from "../../../domain/assets/movie/entity/movie";
import { IMovieRepository } from "../../../domain/assets/movie/repository/movie-repository";
import { MovieMetadata } from "../../../domain/assets/movie/vo/movie-metadata";
import { MovieId } from "../../../domain/assets/movie/vo/movie-id";
import { injectable } from "tsyringe";
import { GoogleDriveService } from "/root/google_apps_script/octopus-scheduler/src/server/shared-packages/src/google-drive-service";

@injectable()
export class MovieRepository implements IMovieRepository {

    private static readonly movieFolderId: string = PropertiesService.getScriptProperties().getProperty('octopus-schedule-api-movie') ?? (() => { throw new Error('Movie folder ID is not set in ScriptProperties.'); })();

    save(movie: Movie): void {
        const folderId = MovieRepository.movieFolderId;
        let mimeType: string = 'video/mp4';
        if (movie.movieData.getContentType) {
            const mt = movie.movieData.getContentType();
            if (mt) mimeType = mt;
        }
        GoogleDriveService.uploadFile({
            fileId: movie.id.toString(),
            fileName: movie.name,
            parentFolderId: folderId,
            mimeType: mimeType,
            blob: movie.movieData
        });
    }

    findById(id: MovieId): Movie | null {
        try {
            const file = DriveApp.getFileById(id.toString());
            return Movie.fromEntity(new MovieId(file.getId()), file.getName(), file.getBlob());
        } catch (e) {
            return null;
        }
    }

    findAll(): Movie[] {
        const folderId = MovieRepository.movieFolderId;
        const files = DriveApp.getFolderById(folderId).getFiles();
        const movies: Movie[] = [];
        while (files.hasNext()) {
            const file = files.next();
            movies.push(Movie.fromEntity(new MovieId(file.getId()), file.getName(), file.getBlob()));
        }
        return movies;
    }

    findAllMetadatas(): MovieMetadata[] {
        const folderId = MovieRepository.movieFolderId;
        const files = DriveApp.getFolderById(folderId).getFiles();
        const metadatas: MovieMetadata[] = [];
        while (files.hasNext()) {
            const file = files.next();
            const lastUpdated = file.getLastUpdated();
            metadatas.push(new MovieMetadata(
                file.getId(),
                file.getName(),
                new Date(typeof lastUpdated === 'string' ? Date.parse(lastUpdated) : lastUpdated.valueOf())
            ));
        }
        return metadatas;
    }

    delete(id: MovieId): void {
        GoogleDriveService.deleteFilesOrFolders([id.toString()]);
    }
}
