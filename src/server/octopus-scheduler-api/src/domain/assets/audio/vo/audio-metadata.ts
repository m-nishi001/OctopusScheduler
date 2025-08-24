export class AudioMetadata {
    constructor(
        public readonly audioId: string,
        public readonly audioName: string,
        public readonly lastUpdatedAt: Date
    ) { }
}