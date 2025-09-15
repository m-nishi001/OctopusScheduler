
export class TransitionPageEventTypeDto {
  readonly eventType = "TransitionPageEvent";
  readonly displayName = "ページ遷移イベント";
  readonly displayDescription = "指定したページに遷移します。";
  readonly settingsSchema: any;

  constructor(pageList: { id: string; name: string }[]) {
    this.settingsSchema = {
      type: "object",
      properties: {
        pageId: {
          type: "string",
          title: "ページ",
          description: "遷移先ページを選択",
          oneOf: pageList.map(page => ({ const: page.id, title: page.name }))
        }
      },
      required: ["pageId"]
    };
  }
}
