// HomeScreenSetting is a concrete data class for the home screen.
export class HomeScreenSetting {
  readonly type: "home" = "home";
  homeBgm: string;
  buttonClikingSE: string;
  onCompletedLoadingSE: string;
  title: string;
  subtitle: string;

  constructor(
    homeBgm: string,
    buttonClikingSE: string,
    onCompletedLoadingSE: string,
    title: string = "2025年度 ジャックポッド大会！",
    subtitle: string = ""
  ) {
    this.homeBgm = homeBgm;
    this.buttonClikingSE = buttonClikingSE;
    this.onCompletedLoadingSE = onCompletedLoadingSE;
    this.title = title;
    this.subtitle = subtitle;
  }

  toRecords(): Map<string, string> {
    const records = new Map<string, string>();
    records.set("homeBgm", this.homeBgm);
    records.set("buttonClikingSE", this.buttonClikingSE);
    records.set("onCompletedLoadingSE", this.onCompletedLoadingSE);
    records.set("title", this.title);
    records.set("subtitle", this.subtitle);
    return records;
  }

  static fromRecords(records: Map<string, string>): HomeScreenSetting {
    return new HomeScreenSetting(
      records.get("homeBgm") || "",
      records.get("buttonClikingSE") || "",
      records.get("onCompletedLoadingSE") || "",
      records.get("title") || "2025年度 ジャックポッド大会！",
      records.get("subtitle") || ""
    );
  }
}
