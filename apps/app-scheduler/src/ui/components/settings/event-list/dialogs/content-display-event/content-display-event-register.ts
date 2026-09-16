import type { Asset } from "../../../../../../model/domains/assets/entity/asset";
import { AssetService } from "../../../../../../model/applications/assets/asset-service";
import { AppEventService } from "../../../../../../model/applications/app-event/app-event-service";
import {
  ShowContentEvent,
  ShowContentEventParams,
} from "../../../../../../model/domains/app-event/show-content/show-content-event";

export interface RegisterInput {
  startTime: Date;
  endTime: Date;
  contentType: "image" | "movie" | "html";
  contentId?: string;
  htmlString?: string;
  fadeOutDuration?: number;
  displayMode?: any;
  effect?: any;
  duration?: number;
  fadeInTime?: number;
  fadeOutTime?: number;
  scrollDirection?: any;
  uploadFiles?: Array<{ tempId: string; file: File }>;
  existingEvent?: ShowContentEvent | undefined;
}

export class ContentDisplayEventRegister {
  constructor(
    private assetService: AssetService,
    private scheduleEventService: AppEventService
  ) {}

  private generateTempToRealMap(
    uploadFiles: Array<{ tempId: string; file: File }>
  ) {
    const tempOrder: string[] = [];
    const assetsToAdd: Asset[] = [];
    for (const entry of uploadFiles || []) {
      tempOrder.push(entry.tempId);
      const f = entry.file;
      assetsToAdd.push({
        id: "",
        name: f.name,
        uploadedAt: new Date().toISOString(),
        lastUpdated: new Date().toISOString(),
        size: f.size,
        blob: f,
      } as any);
    }
    return { tempOrder, assetsToAdd } as const;
  }

  private async uploadQueuedAssets(
    currentContentId: string | undefined,
    currentHtml: string | undefined,
    uploadFiles: Array<{ tempId: string; file: File }> | undefined
  ) {
    const queued = uploadFiles || [];
    if (!queued.length)
      return {
        contentId: currentContentId ?? "",
        htmlString: currentHtml ?? "",
      };
    const { tempOrder, assetsToAdd } = this.generateTempToRealMap(queued);
    if (!assetsToAdd.length)
      return {
        contentId: currentContentId ?? "",
        htmlString: currentHtml ?? "",
      };
    const ids = await this.assetService.addAssets(assetsToAdd);
    const tempToReal: Record<string, string> = {};
    for (let i = 0; i < tempOrder.length; i++)
      tempToReal[tempOrder[i]] = ids[i];

    let html = currentHtml ?? "";
    for (const tempId of tempOrder) {
      const realId = tempToReal[tempId];
      const regex = new RegExp(
        `\\{\\{asset:(image|video):${tempId}\\}\\}`,
        "g"
      );
      html = html.replace(regex, function (_match: string, type: string) {
        return `{{asset:${type}:${realId}}}`;
      });
    }

    let newContentId = currentContentId ?? "";
    if (currentContentId && tempToReal[currentContentId])
      newContentId = tempToReal[currentContentId];

    return { contentId: newContentId, htmlString: html };
  }

  async register(input: RegisterInput): Promise<void> {
    const uploaded = await this.uploadQueuedAssets(
      input.contentId,
      input.htmlString,
      input.uploadFiles
    );
    const contentId = uploaded.contentId;
    const htmlString = uploaded.htmlString;

    const params = {
      startTime: input.startTime,
      endTime: input.endTime,
      contentType: input.contentType,
      contentId,
      htmlString,
      fadeOutDuration: input.fadeOutDuration,
      displayMode: input.displayMode,
      effect: input.effect,
      duration: input.duration,
      fadeInTime: input.fadeInTime,
      fadeOutTime: input.fadeOutTime,
      scrollDirection: input.scrollDirection,
    } as const;

    if (input.existingEvent) {
      const p = new ShowContentEventParams({
        id: input.existingEvent.id,
        ...params,
        processedAt: input.existingEvent.processedAt,
        registeredAt: input.existingEvent.registeredAt,
        updatedAt: new Date(),
      });
      const updated = ShowContentEvent.fromParams(p);
      await this.scheduleEventService.updateScheduleEvents([updated]);
    } else {
      const p = new ShowContentEventParams({
        id: "",
        ...params,
        processedAt: null,
        registeredAt: new Date(),
        updatedAt: new Date(),
      });
      const tmp = ShowContentEvent.fromParams(p);
      await this.scheduleEventService.addScheduleEvents([tmp]);
    }
  }
}
