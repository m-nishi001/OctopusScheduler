export type ScreenType =
  | "home"
  | "opening"
  | "description"
  | "demo"
  | "main"
  | "result"
  | "ending";

export interface IScreenConfig {
  type: ScreenType;
  toRecords(): Map<string, string>;
}
