export type ScreenType =
  | "home"
  | "opening"
  | "description"
  | "demo"
  | "main"
  | "result"
  | "admin";

export interface IScreenConfig {
  id: string;
  type: ScreenType;
  toRecords(): Map<string, string>;
}
