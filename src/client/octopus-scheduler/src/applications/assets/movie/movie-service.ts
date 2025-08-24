import { Movie } from "src/domains/assets/movie/entity/movie";
import type { IMovieRepository } from "src/domains/assets/movie/repository/movie-repository";
import { MovieId } from "src/domains/assets/movie/vo/movie-id";
import { MovieRepository } from "src/infrastructures/assets/movie/movie-repository";

/**
 * MovieエンティティのCRUD操作を調整するアプリケーションサービス。
 * ドメイン層とインフラ層を疎結合に保ち、プレゼンテーション層からの要求を処理します。
 */
export class MovieService {
    private readonly movieRepository: IMovieRepository;

    constructor() {
        this.movieRepository = new MovieRepository();
    }

    /**
     * 新しい動画を保存する
     * @param movieName 動画名
     * @param data Blob形式の動画データ
     */
    public async saveNewMovie(movieName: string, data: Blob): Promise<void> {
        try {
            const movie = Movie.createNew(movieName, data);
            await this.movieRepository.save(movie);
        } catch (error) {
            console.error("Failed to save new movie:", error);
            throw new Error("Failed to save new movie.");
        }
    }

    /**
     * 指定されたIDの動画を取得する
     * @param movieId 動画ID
     * @returns Movieエンティティまたはnull
     */
    public async getMovieById(movieId: string): Promise<Movie | null> {
        try {
            const id = new MovieId(movieId);
            return await this.movieRepository.findById(id);
        } catch (error) {
            console.error(`Failed to get movie with ID ${movieId}:`, error);
            return null;
        }
    }

    /**
     * すべての動画を取得する
     * @returns Movieエンティティの配列
     */
    public async getAllMovies(): Promise<Movie[]> {
        try {
            return await this.movieRepository.findAll();
        } catch (error) {
            console.error("Failed to get all movies:", error);
            return [];
        }
    }

    /**
     * 指定された動画を削除する
     * @param movieId 削除する動画のID
     */
    public async deleteMovie(movieId: string): Promise<void> {
        try {
            const id = new MovieId(movieId);
            await this.movieRepository.delete(id);
        } catch (error) {
            console.error(`Failed to delete movie with ID ${movieId}:`, error);
            throw new Error("Failed to delete movie.");
        }
    }

    /**
     * ローカルストレージとリモートの動画データを同期する
     */
    public async syncMovies(): Promise<void> {
        try {
            await this.movieRepository.sync();
            console.log("Movies synchronized successfully.");
        } catch (error) {
            console.error("Failed to sync movies:", error);
            throw new Error("Failed to sync movies.");
        }
    }
}
