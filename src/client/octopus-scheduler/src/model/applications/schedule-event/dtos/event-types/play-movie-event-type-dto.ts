export class PlayMovieEventTypeDto {
  readonly eventType = "PlayMovieEvent";
  readonly displayName = "動画再生イベント";
  readonly displayDescription = "指定した動画を再生します。";
  readonly settingsSchema: any;

  constructor(movieAssets: { id: string; name: string }[]) {
    this.settingsSchema = {
      type: "object",
      properties: {
        movieId: {
          type: "string",
          title: "動画",
          description: "動画のアセット群から選択",
          oneOf: movieAssets.map(asset => ({ const: asset.id, title: asset.name }))
        }
      },
      required: ["movieId"]
    };
  }
}
