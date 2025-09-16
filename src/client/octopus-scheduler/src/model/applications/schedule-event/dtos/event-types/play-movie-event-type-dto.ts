import type { FormSchema, FormOption } from '../form-schema';

export class PlayMovieEventTypeDto {
  readonly eventType = "PlayMovieEvent";
  readonly displayName = "動画再生イベント";
  readonly displayDescription = "指定した動画を再生します。";
  readonly settingsSchema: FormSchema;

  constructor(movieAssets: { id: string; name: string }[]) {
    const options: FormOption[] = movieAssets.map(asset => ({
      value: asset.id,
      label: asset.name
    }));
    this.settingsSchema = {
      properties: [
        {
          key: "movieId",
          label: "動画",
          description: "動画のアセット群から選択",
          controlType: "dropdown",
          required: true,
          options
        }
      ]
    };
  }
}
