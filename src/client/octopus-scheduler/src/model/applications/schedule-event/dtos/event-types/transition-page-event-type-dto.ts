import type { FormSchema, FormOption } from '../form-schema';

export class TransitionPageEventTypeDto {
  readonly eventType = "TransitionPageEvent";
  readonly displayName = "ページ遷移イベント";
  readonly displayDescription = "指定したページに遷移します。";
  readonly settingsSchema: FormSchema;

  constructor(pageList: { id: string; name: string }[]) {
    const options: FormOption[] = pageList.map(page => ({
      value: page.id,
      label: page.name
    }));
    this.settingsSchema = {
      properties: [
        {
          key: "pageId",
          label: "ページ",
          description: "遷移先ページを選択",
          controlType: "dropdown",
          required: true,
          options
        }
      ]
    };
  }
}
