export interface IScheduleEvent {
  readonly id: string;
  readonly type: string;
  readonly startTime: Date;
  readonly endTime: Date;
  readonly processedAt: Date | null;
  readonly registeredAt: Date;
  readonly updatedAt: Date;
  // manual: if true, the execution is triggered by a manual action (e.g. keyboard shortcut)
  // and should not be stopped automatically by scheduling framework. This allows
  // the calling code to decide when to pair stop events.
  execute(isStart: boolean, manual?: boolean): Promise<void>;
  serialize(): string[];
  serializeAsObject(): Record<string, unknown>;
}
