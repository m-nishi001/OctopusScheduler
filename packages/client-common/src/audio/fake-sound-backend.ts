import type { SoundBackend } from "./sound-system";

/** 何も鳴らさない `SoundBackend`(テスト用)。再生の状態だけを持ち、時間は `advance` で進める。 */
export class FakeSoundBackend implements SoundBackend {
    state: AudioContextState = "suspended";
    readonly calls: string[] = [];
    private readonly listeners = new Set<() => void>();
    private readonly instances = new Map<string, { playing: boolean; offset: number; startedAt: number; gain: number; onEnded?: () => void }>();
    private seq = 0;
    private clock = 0;
    /** 次の `loadFromBlob` を、この Promise が解決するまで待たせる(読み込み中の状態を作る)。 */
    holdLoad: Promise<void> | null = null;
    failPlay = false;

    async unlock(): Promise<void> {
        if (this.state === "running") return;
        this.calls.push("unlock");
        this.state = "running";
        for (const l of [...this.listeners]) l();
    }
    onStateChange(listener: () => void): () => void {
        this.listeners.add(listener);
        return () => this.listeners.delete(listener);
    }
    async loadFromBlob(blob: Blob): Promise<string> {
        if (this.holdLoad) await this.holdLoad;
        const id = `i${++this.seq}`;
        this.calls.push(`load:${id}:${blob.size}`);
        this.instances.set(id, { playing: false, offset: 0, startedAt: 0, gain: 1 });
        return id;
    }
    async play(id: string, fadeInMs = 0, loop = false, onEnded?: () => void): Promise<void> {
        const i = this.get(id);
        if (this.failPlay) throw new Error("play failed");
        this.calls.push(`play:${id}:fadeIn=${fadeInMs}:loop=${loop}`);
        Object.assign(i, { playing: true, startedAt: this.clock, onEnded, gain: fadeInMs > 0 ? 0 : 1 });
    }
    async pause(id: string, fadeOutMs = 0): Promise<void> {
        const i = this.get(id);
        this.calls.push(`pause:${id}:fade=${fadeOutMs}`);
        i.offset += this.clock - i.startedAt;
        i.playing = false;
    }
    async stop(id: string, fadeOutMs = 0): Promise<void> {
        const i = this.get(id);
        this.calls.push(`stop:${id}:fade=${fadeOutMs}`);
        Object.assign(i, { playing: false, offset: 0, onEnded: undefined });
    }
    disposeInstance(id: string): void {
        this.get(id);
        this.calls.push(`dispose:${id}`);
        this.instances.delete(id);
    }
    getCurrentTime(id: string): number {
        const i = this.get(id);
        return i.offset + (i.playing ? this.clock - i.startedAt : 0);
    }
    getGain(id: string): number {
        return this.get(id).gain;
    }

    // ---- 動画などの要素 ----
    private readonly elements = new Map<string, { gain: number; finishFade: (() => void) | null }>();
    private elementSeq = 0;
    attachElement(): string {
        const id = `e${++this.elementSeq}`;
        this.calls.push(`attachElement:${id}`);
        this.elements.set(id, { gain: 1, finishFade: null });
        return id;
    }
    fadeOutElement(id: string, fadeOutMs: number): Promise<void> {
        const e = this.elements.get(id);
        if (!e) return Promise.resolve();
        this.calls.push(`fadeOutElement:${id}:fade=${fadeOutMs}`);
        return new Promise<void>((resolve) => {
            e.finishFade = () => {
                e.finishFade = null;
                resolve();
            };
        });
    }
    getElementGain(id: string): number {
        const e = this.elements.get(id);
        if (!e) throw new Error(`no element ${id}`);
        return e.gain;
    }
    detachElement(id: string): void {
        const e = this.elements.get(id);
        if (!e) return;
        this.calls.push(`detachElement:${id}`);
        e.finishFade?.();
        this.elements.delete(id);
    }
    /** 動画の音のフェードアウトが終わったことにする(音量は 0 になる)。 */
    finishElementFade(id: string): void {
        const e = this.elements.get(id);
        if (!e) return;
        e.gain = 0;
        e.finishFade?.();
    }

    /** 時間(秒)を進める。 */
    advance(seconds: number): void {
        this.clock += seconds;
    }
    /** 曲が自然に終わったことにする。 */
    end(id: string): void {
        const i = this.get(id);
        i.playing = false;
        i.onEnded?.();
    }
    /** 読み込まれたまま、まだ破棄されていない再生。 */
    get alive(): string[] {
        return [...this.instances.keys()];
    }
    /** 鳴っている再生。 */
    get playingIds(): string[] {
        return [...this.instances].filter(([, i]) => i.playing).map(([id]) => id);
    }
    private get(id: string) {
        const i = this.instances.get(id);
        if (!i) throw new Error(`Audio instance with ID ${id} not found.`);
        return i;
    }
}
