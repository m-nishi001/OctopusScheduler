export class PlayAudioEventTypeDto {
  readonly eventType = "PlayAudioEvent";
  readonly displayName = "音声再生イベント";
  readonly displayDescription = "指定した音声を再生します。";
    readonly settingsSchema: FormSchema;

  constructor(audioAssets: { id: string; name: string }[]) {
      const options: FormOption[] = audioAssets.map(asset => ({
        value: asset.id,
        label: asset.name
      }));
      this.settingsSchema = {
        properties: [
          {
            key: "audioId",
            label: "音楽",
            description: "音楽のアセット群から選択",
            controlType: "dropdown",
            required: true,
            options
          }
        ]
      };
  }
}
import type { FormSchema, FormOption } from '../form-schema';
