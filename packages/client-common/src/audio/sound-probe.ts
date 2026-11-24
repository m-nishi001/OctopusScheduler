import type { SoundSystem } from "./sound-system";

/** テストが読む、音の状態の窓口(`window.__sound`)。 */
export interface SoundProbe {
    snapshot: SoundSystem["snapshot"];
}

/**
 * 自動操作のブラウザ(e2e: `navigator.webdriver`)のときだけ、各チャンネルの状態を `window.__sound.snapshot()` で読めるようにする。
 * 普段の画面には出さない。e2e は、これで「鳴っている・止まった・続いている・切り替わった」を耳に頼らず確かめる。
 * `env` は単体テスト用。
 */
export function exposeSoundProbe(
    sound: SoundSystem,
    env: { webdriver: boolean; target: Record<string, unknown> } = { webdriver: typeof navigator !== "undefined" && navigator.webdriver === true, target: globalThis as unknown as Record<string, unknown> }
): boolean {
    if (!env.webdriver) return false;
    const probe: SoundProbe = { snapshot: () => sound.snapshot() };
    env.target.__sound = probe;
    return true;
}
