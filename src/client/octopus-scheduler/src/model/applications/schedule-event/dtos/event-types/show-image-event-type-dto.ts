export class ShowImageEventTypeDto {
  readonly eventType = "ShowImageEvent";
  readonly displayName = "画像表示イベント";
  readonly displayDescription = "指定した画像を表示します。";
  readonly settingsSchema: any;

  constructor(imageAssets: { id: string; name: string }[]) {
    this.settingsSchema = {
      type: "object",
      properties: {
        imageId: {
          type: "string",
          title: "画像",
          description: "画像のアセット群から選択",
          oneOf: imageAssets.map(asset => ({ const: asset.id, title: asset.name }))
        }
      },
      required: ["imageId"]
    };
  }
}
