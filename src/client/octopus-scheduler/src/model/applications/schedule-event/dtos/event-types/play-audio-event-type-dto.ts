export class PlayAudioEventTypeDto {
  readonly eventType = "PlayAudioEvent";
  readonly displayName = "音声再生イベント";
  readonly displayDescription = "指定した音声を再生します。";
  readonly settingsSchema: any;

  constructor(audioAssets: { id: string; name: string }[]) {
    this.settingsSchema = {
      type: "object",
      properties: {
        audioId: {
          type: "string",
          title: "音楽",
          description: "音楽のアセット群から選択",
          oneOf: audioAssets.map(asset => ({ const: asset.id, title: asset.name }))
        }
      },
      required: ["audioId"]
    };
  }
}
