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
}

export class ScheduleEvent {
  public readonly id: string;
  public readonly type: string;
  public readonly settingName: string;
  public readonly settingValue: string;

  constructor(
    id: string,
    type: string,
    settingName: string,
    settingValue: string
  ) {
    this.id = id;
    this.type = type;
    this.settingName = settingName;
    this.settingValue = settingValue;
  }
}
