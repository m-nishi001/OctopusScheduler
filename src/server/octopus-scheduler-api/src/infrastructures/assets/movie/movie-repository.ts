import { Movie } from "../../../domain/assets/movie/entity/movie";
import { IMovieRepository } from "../../../domain/assets/movie/repository/movie-repository";
import { MovieId } from "../../../domain/assets/movie/vo/movie-id";
import { injectable } from "tsyringe";
import { GoogleDriveService } from "/root/google_apps_script/octopus-scheduler/src/server/shared-packages/src/google-drive-service";

@injectable()
export class MovieRepository implements IMovieRepository {
    private folderName = "MovieAssets"; // 動画ファイルを保存するGoogle Driveのフォルダ名

    private getMovieFolderId(): string {
        const rootFolder = DriveApp.getRootFolder();
        const folders = rootFolder.getFoldersByName(this.folderName);
        let folder = folders.hasNext() ? folders.next() : rootFolder.createFolder(this.folderName);
        return folder.getId();
    }

    async save(movie: Movie): Promise<void> {
        const folderId = this.getMovieFolderId();
        let mimeType: string = 'video/mp4';
        if (movie.movieData.getContentType) {
            const mt = movie.movieData.getContentType();
            if (mt) mimeType = mt;
        }
        await GoogleDriveService.uploadFile({
            fileId: movie.id.toString(),
            fileName: movie.name,
            parentFolderId: folderId,
            mimeType: mimeType,
            blob: movie.movieData
        });
    }

    async findById(id: MovieId): Promise<Movie | null> {
        const folderId = this.getMovieFolderId();
        const files = await GoogleDriveService.findFileByIds({ fileIds: [id.toString()], parentFolderId: folderId });
        if (files.length > 0) {
            const file = files[0];
            return Movie.fromEntity(new MovieId(file.getId()), file.getName(), file.getBlob());
        }
        return null;
    }

    async findAll(): Promise<Movie[]> {
        const folderId = this.getMovieFolderId();
        const files = DriveApp.getFolderById(folderId).getFiles();
        const movies: Movie[] = [];
        while (files.hasNext()) {
            const file = files.next();
            movies.push(Movie.fromEntity(new MovieId(file.getId()), file.getName(), file.getBlob()));
        }
        return movies;
    }

    async delete(id: MovieId): Promise<void> {
        await GoogleDriveService.deleteFilesOrFolders([id.toString()]);
    }
}
