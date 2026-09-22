export class ScreenSetting {
  public readonly screenName: string;
  public readonly settingName: string;
  public readonly settingValue: string;

  constructor(screenName: string, settingName: string, settingValue: string) {
    this.screenName = screenName;
    this.settingName = settingName;
    this.settingValue = settingValue;
  }
}
