/** 画面設定の1項目(画面名・項目名・値)。 */
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
