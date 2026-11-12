/** デモ画面の設定(BGM・抽選の効果音)。 */
export class DemoScreenSetting {
  readonly type = "demo" as const;
  demoBgm: string;
  demoDrawSe: string;

  constructor(demoBgm: string, demoDrawSe: string) {
    this.demoBgm = demoBgm;
    this.demoDrawSe = demoDrawSe;
  }

  toRecords(): Map<string, string> {
    const records = new Map<string, string>();
    records.set("demoBgm", this.demoBgm);
    records.set("demoDrawSe", this.demoDrawSe);
    return records;
  }

  static fromRecords(records: Map<string, string>): DemoScreenSetting {
    return new DemoScreenSetting(records.get("demoBgm") || "", records.get("demoDrawSe") || "");
  }
}
