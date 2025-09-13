export class ShowImageEventDetail {
  imageUrl: string;
  altText?: string;
  constructor(imageUrl: string, altText?: string) {
    this.imageUrl = imageUrl;
    this.altText = altText;
  }
}
