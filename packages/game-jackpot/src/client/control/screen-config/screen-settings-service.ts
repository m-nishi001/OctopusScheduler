import { injectable, inject } from "tsyringe";
import { JackpotRepository } from "../../model/jackpot-repository";
import { ScreenSetting } from "../../model/screen-config/screen-setting";

/** 各画面(オープニング・説明・エンディング・デモ・結果・本抽選)の設定の取得・保存。保存のとき、選んだだけの素材(BGM・画像)も一緒に登録する。 */
@injectable()
export class ScreenSettingsService {
  constructor(@inject(JackpotRepository) private readonly repo: JackpotRepository) {}

  /**
   * 画面ごと・項目ごとに、設定1件を保存する。`files` は、設定が名前で参照している、選んだばかりの素材(名前 → 中身)。
   * 素材の索引は保存のたびに作り直されるので、設定から外した素材は自然に消える。
   */
  async saveScreenSetting(screenName: string, settingName: string, payload: unknown, files?: ReadonlyMap<string, Blob>): Promise<void> {
    const ss = new ScreenSetting(screenName, settingName, JSON.stringify(this.sanitizeDates(payload)));
    await this.repo.updateScreenSettings([ss], files);
  }

  async fetchScreenSetting(screenName: string, settingName: string): Promise<any | null> {
    const found = (await this.repo.getScreenSettingsByType(screenName)).find((s) => s.settingName === settingName);
    if (!found) return null;
    try {
      return JSON.parse(found.settingValue) as any;
    } catch {
      return null;
    }
  }

  async listScreenSettings(screenName: string): Promise<any[]> {
    const settings = await this.repo.getScreenSettingsByType(screenName);
    return settings
      .map((s) => {
        try {
          return JSON.parse(s.settingValue) as any;
        } catch {
          return null as any;
        }
      })
      .filter(Boolean) as any[];
  }

  // convert Date objects to ISO strings recursively for safety
  private sanitizeDates(obj: any): any {
    if (obj == null) return obj;
    if (obj instanceof Date) return obj.toISOString();
    if (Array.isArray(obj)) return obj.map((v) => this.sanitizeDates(v));
    if (typeof obj === "object") {
      const out: any = {};
      for (const k of Object.keys(obj)) out[k] = this.sanitizeDates(obj[k]);
      return out;
    }
    return obj;
  }
}
