export class ImageMetadata {
    constructor(
        public readonly imageId: string,
        public readonly imageName: string,
        public readonly lastUpdatedAt: Date
    ) { }
}