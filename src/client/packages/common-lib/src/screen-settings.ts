export class ScreenSetting {
  public readonly id: string;
  public readonly screenName: string;
  public readonly settingName: string;
  public readonly settingValue: string;

  constructor(
    id: string,
    screenName: string,
    settingName: string,
    settingValue: string
  ) {
    this.id = id;
    this.screenName = screenName;
    this.settingName = settingName;
    this.settingValue = settingValue;
  }
}
