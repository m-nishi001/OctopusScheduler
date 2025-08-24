export class MovieMetadata {
    constructor(
        public readonly movieId: string,
        public readonly movieName: string,
        public readonly lastUpdatedAt: Date
    ) { }
}