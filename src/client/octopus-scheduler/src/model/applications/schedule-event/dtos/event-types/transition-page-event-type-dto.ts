import type { FormSchema } from '../form-schema';
import { TransitionPageEvent } from '../../../../domains/schedule-event/entity/events/transition-page-event';

export class TransitionPageEventTypeDto {
    readonly eventType = TransitionPageEvent.scheduleEventTypeName;
    readonly displayName = "ページ遷移イベント";
    readonly displayDescription = "指定したページに遷移します。";
    readonly settingsSchema: FormSchema;

    constructor() {
        this.settingsSchema = {
            properties: [
                {
                    key: "pageUrl",
                    label: "遷移先URL",
                    description: "遷移先のURLを手入力してください。",
                    controlType: "text",
                    required: true
                }
            ]
        };
    }
}
