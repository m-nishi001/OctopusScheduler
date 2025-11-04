export interface IScheduleEvent {
  readonly id: string;
  readonly type: string;
  readonly startTime: Date;
  readonly endTime: Date;
  readonly processedAt: Date | null;
  readonly registeredAt: Date;
  readonly updatedAt: Date;
  execute(isStart: boolean): Promise<void>;
  serialize(): string[];
  serializeAsObject(): Record<string, unknown>;
}
