export class ScheduleEvent {
  public readonly id: string;
  public readonly type: string;
  public readonly eventType: string;
  public readonly settingName: string;
  public readonly settingValue: string;

  constructor(
    id: string,
    type: string,
    eventType: string,
    settingName: string,
    settingValue: string
  ) {
    this.id = id;
    this.type = type;
    this.eventType = eventType;
    this.settingName = settingName;
    this.settingValue = settingValue;
  }
}
