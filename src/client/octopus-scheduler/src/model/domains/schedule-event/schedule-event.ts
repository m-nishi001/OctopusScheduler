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
