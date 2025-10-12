export type ScreenType =
  | "home"
  | "opening"
  | "description"
  | "demo"
  | "main"
  | "result"
  | "ending";

export interface IScreenSetting {
  type: ScreenType;
  toRecords(): Map<string, string>;
}
