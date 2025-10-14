import { AssetService } from "../assets/asset-service";

export interface IScheduleEventDto {
  readonly id: string;
  readonly type: string;
  readonly startTime: Date;
  readonly endTime: Date;
  readonly processedAt: Date | null;
  readonly registeredAt: Date;
  readonly updatedAt: Date;
  execute(isStart: boolean): Promise<void>;
  toRecords(): Map<string, string>;
  registerAssetRefs(assetService: AssetService, eventId: string): Promise<void>;
  unregisterAssetRefs(assetService: AssetService): Promise<void>;
}
