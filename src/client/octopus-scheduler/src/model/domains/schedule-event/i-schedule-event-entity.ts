export interface IScheduleEventEntity {
  readonly id: string;
  readonly type: string;
  readonly startTime: Date;
  readonly endTime: Date;
  readonly processedAt: Date | null;
  readonly registeredAt: Date;
  readonly updatedAt: Date;
  toRecords(): Map<string, string>;
}
