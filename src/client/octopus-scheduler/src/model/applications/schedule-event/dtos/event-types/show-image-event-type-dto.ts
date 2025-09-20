import { ShowImageEvent } from '../../../../domains/schedule-event/entity/events/show-image-event';
export class ShowImageEventTypeDto {
  readonly eventType = ShowImageEvent.scheduleEventTypeName;
  readonly displayName = "画像表示イベント";
  readonly displayDescription = "指定した画像を表示します。";
  readonly settingsSchema: FormSchema;

  constructor(imageAssets: { id: string; name: string }[]) {
    const options: FormOption[] = imageAssets.map(asset => ({
      value: asset.id,
      label: asset.name
    }));
    this.settingsSchema = {
      properties: [
        {
          key: "imageId",
          label: "画像",
          description: "画像のアセット群から選択",
          controlType: "dropdown",
          required: true,
          options
        }
      ]
    };
  }
}
import type { FormSchema, FormOption } from '../form-schema';
