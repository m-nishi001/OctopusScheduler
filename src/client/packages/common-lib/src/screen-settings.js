export class ScreenSetting {
  constructor(id, screenName, settingName, settingValue) {
    Object.defineProperty(this, "id", {
      enumerable: true,
      configurable: true,
      writable: true,
      value: void 0,
    });
    Object.defineProperty(this, "screenName", {
      enumerable: true,
      configurable: true,
      writable: true,
      value: void 0,
    });
    Object.defineProperty(this, "settingName", {
      enumerable: true,
      configurable: true,
      writable: true,
      value: void 0,
    });
    Object.defineProperty(this, "settingValue", {
      enumerable: true,
      configurable: true,
      writable: true,
      value: void 0,
    });
    this.id = id;
    this.screenName = screenName;
    this.settingName = settingName;
    this.settingValue = settingValue;
  }
}
