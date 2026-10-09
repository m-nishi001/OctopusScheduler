export declare const APP_MODES: readonly ["development", "production"];
export declare function parseAppMode(text: string): "development" | "production";
export declare function loadAppMode(path?: string): "development" | "production";
export declare function appModeDefine(path?: string): { __APP_MODE__: string };
