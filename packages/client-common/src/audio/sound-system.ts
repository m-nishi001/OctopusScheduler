/**
 * 音を鳴らす中心の部品。1ページに1つだけ作り、Web Audio(`AudioService`)の AudioContext を共有する。
 *
 * - 自動再生の制限の解除(`unlock`)とその状態は、ここだけが持つ。
 * - 曲は `{ key, load }` で渡す。素材の取り方は呼ぶ側が決めるので、ここは知らない。
 * - 3つのチャンネルが、使う場面ごとの決まりを持つ:
 *   - `venue`  : 場内BGM。同じ key をもう一度鳴らすと、古い方をフェードアウトしながら新しい方を鳴らす(クロスフェード)。ゲームに入ると一時停止し、出ると続きから再開する。
 *   - `screen` : ゲームの画面のBGM。同じ key なら何もしない(流し続ける)。違えば前の曲を止めて切り替える。ゲームを出ると止まる。
 *   - `effect` : 効果音。同時に何個でも鳴らせる。ゲームを出ると止まる。
 * - スクリーンの動画の音も、ここを通す(`attachVideo`)。フェードアウトは音量の予約で行い、動画の要素の `volume` は触らない。
 * - 再生は失敗しても例外にしない(戻り値 `PlayResult` で分かる)。演出を止めないため。
 * - 読み込み中に画面を閉じたときの取りやめは `signal`、古い読み込みの結果を捨てる処理はチャンネルが持つ。
 */

/** 曲。`key` が同じなら同じ曲として扱う。`load` は鳴らす直前まで呼ばれない。 */
export interface SoundSource {
    key: string;
    load: () => Promise<Blob>;
}

/** 音を実際に鳴らす部品(`AudioService` がこの形を満たす)。テストでは偽物に差し替える。 */
export interface SoundBackend {
    readonly state: AudioContextState;
    unlock(): Promise<void>;
    onStateChange(listener: () => void): () => void;
    loadFromBlob(blob: Blob): Promise<string>;
    play(id: string, fadeInMs?: number, loop?: boolean, onEnded?: () => void): Promise<void>;
    pause(id: string, fadeOutMs?: number): Promise<void>;
    stop(id: string, fadeOutMs?: number): Promise<void>;
    disposeInstance(id: string): void;
    getCurrentTime(id: string): number;
    /** いまの実際の音量(フェードの途中は途中の値)。 */
    getGain(id: string): number;
    /** 動画などの要素の音を、音の通り道に組み込む(1つの要素に1回だけ)。要素の ID を返す。 */
    attachElement(element: HTMLMediaElement): string;
    /** 組み込んだ要素の音を、`fadeOutMs` かけて 0 まで下げる。下げ終わると解決する(途中で外されたら、そこで解決する)。 */
    fadeOutElement(id: string, fadeOutMs: number): Promise<void>;
    /** 組み込んだ要素の、いまの実際の音量。 */
    getElementGain(id: string): number;
    /** 組み込んだ要素を外す。 */
    detachElement(id: string): void;
}

export interface PlayOptions {
    /** 止めるまで繰り返す。既定は1回だけ。 */
    loop?: boolean;
    /** 読み込みが終わってから鳴らし始めるまでの待ち。 */
    delayMs?: number;
    fadeInMs?: number;
    /** 中止すると、読み込み中・待ち中の再生を取りやめる(鳴り始めたあとは何もしない)。 */
    signal?: AbortSignal;
    /** 別の曲(`screen`)・同じ曲(`venue`)を置き換えるとき、古い方のフェードアウトの長さ。既定は0(すぐ止める)。 */
    replaceFadeMs?: number;
}

/**
 * - started  : 鳴らし始めた
 * - kept     : すでに同じ曲が鳴って(読み込まれて)いたので、何もしなかった(`screen`)
 * - cancelled: 鳴らす前に、止められた・中止された・別の曲に置き換えられた
 * - failed   : 読み込み・再生に失敗した
 */
export type PlayResult = "started" | "kept" | "cancelled" | "failed";

export interface StopOptions {
    /** 指定すると、その曲だけ止める。省略はすべて。 */
    key?: string;
    fadeMs?: number;
}

export type TrackStatus = "loading" | "playing" | "paused";

export interface TrackState {
    key: string;
    status: TrackStatus;
    loop: boolean;
    /** 経過時間(秒)。読み込み中は 0。 */
    currentTime: number;
    /** いまの音量(0〜1)。読み込み中は 0。 */
    gain: number;
}

export interface ChannelState {
    /** いちばん新しく鳴らした(鳴らそうとしている)曲の key。無ければ null。 */
    current: string | null;
    tracks: TrackState[];
}

/** チャンネルごとの決まり。 */
interface ChannelPolicy {
    /** 同時に1曲だけか(新しい曲が別の key なら、古い曲を止める)。 */
    exclusive: boolean;
    /** 鳴っている曲と同じ key をもう一度鳴らしたとき。keep: 何もしない / replace: 古い方を止めて新しく鳴らす / overlap: 重ねて鳴らす */
    sameKey: "keep" | "replace" | "overlap";
}

interface Track {
    key: string;
    loop: boolean;
    status: TrackStatus;
    /** 読み込み済みの再生の ID(読み込み中は null)。 */
    id: string | null;
    /** 止められた(読み込み・待ちの結果を捨てる印)。 */
    cancelled: boolean;
    /** 鳴らし始めるまでの待ちを、途中で終わらせる。 */
    wake: (() => void) | null;
}

/** 1つのチャンネル。持つ状態は、いま鳴っている(読み込み中・一時停止中も含む)曲の一覧だけ。 */
export class SoundChannel {
    private readonly tracks = new Set<Track>();
    private readonly preloaded = new Map<string, Promise<string | null>>();
    private readonly listeners = new Set<() => void>();
    /** 進行中の一時停止。`resume` は、これが終わってから鳴らす。 */
    private suspending: Promise<void> = Promise.resolve();

    constructor(
        readonly name: string,
        private readonly policy: ChannelPolicy,
        private readonly backend: SoundBackend
    ) {}

    /** 状態の読み取り(テストと「再生中」の表示用)。 */
    get state(): ChannelState {
        const tracks = [...this.tracks].map((t) => ({
            key: t.key,
            status: t.status,
            loop: t.loop,
            currentTime: t.id ? this.backend.getCurrentTime(t.id) : 0,
            gain: t.id && t.status === "playing" ? this.backend.getGain(t.id) : 0,
        }));
        return { current: tracks.at(-1)?.key ?? null, tracks };
    }

    /** 鳴っている曲の一覧が変わったら知らせる。戻り値は解除関数。 */
    subscribe(listener: () => void): () => void {
        this.listeners.add(listener);
        return () => this.listeners.delete(listener);
    }

    private emit(): void {
        for (const listener of [...this.listeners]) listener();
    }

    /** 曲を読み込んで鳴らす。例外にはならない。再生の完了(フェードイン・曲の終わり)は待たない。 */
    async play(src: SoundSource, options: PlayOptions = {}): Promise<PlayResult> {
        const { loop = false, delayMs = 0, fadeInMs = 0, signal, replaceFadeMs = 0 } = options;
        if (signal?.aborted) return "cancelled";
        const sameKey = [...this.tracks].filter((t) => t.key === src.key);
        if (sameKey.length > 0 && this.policy.sameKey === "keep") return "kept";

        // 置き換える曲を止める。古い方の完了は待たない
        const replaced = this.policy.exclusive
            ? [...this.tracks]
            : this.policy.sameKey === "replace"
              ? sameKey
              : [];
        for (const old of replaced) void this.release(old, replaceFadeMs);

        const track: Track = { key: src.key, loop, status: "loading", id: null, cancelled: false, wake: null };
        this.tracks.add(track);
        this.emit();
        const onAbort = () => {
            if (track.status === "loading") void this.release(track, 0);
        };
        signal?.addEventListener("abort", onAbort, { once: true });
        try {
            const id = await this.acquire(src);
            if (track.cancelled) {
                this.backend.disposeInstance(id);
                return "cancelled";
            }
            track.id = id;
            if (delayMs > 0) {
                await new Promise<void>((resolve) => {
                    const timer = setTimeout(resolve, delayMs);
                    track.wake = () => {
                        clearTimeout(timer);
                        resolve();
                    };
                });
                track.wake = null;
                if (track.cancelled) return "cancelled"; // 片づけは止めた側(release)が済ませている
            }
            track.status = "playing";
            this.emit();
            // 鳴らし始める処理は同期的に進む。完了(フェードイン)は待たない
            this.backend.play(id, fadeInMs, loop, () => this.onEnded(track)).catch((error) => {
                console.warn(`[Sound:${this.name}] failed to play`, src.key, error);
                if (!track.cancelled) void this.release(track, 0);
            });
            return "started";
        } catch (error) {
            console.warn(`[Sound:${this.name}] failed to load`, src.key, error);
            if (!track.cancelled) void this.release(track, 0);
            return "failed";
        } finally {
            signal?.removeEventListener("abort", onAbort);
        }
    }

    /** 曲を指定するとその曲だけ、省略するとすべて止める。読み込み中・一時停止中の曲も止める(鳴らさない)。フェードアウトが終わると解決する。 */
    async stop(options: StopOptions = {}): Promise<void> {
        const { key, fadeMs = 0 } = options;
        await Promise.all([...this.tracks].filter((t) => key === undefined || t.key === key).map((t) => this.release(t, fadeMs)));
    }

    /** `key` の曲以外をすべて止める(読み込み中のものも、鳴らさない)。`key` の曲は触らない。 */
    async stopUnless(key: string | null, options: { fadeMs?: number } = {}): Promise<void> {
        const { fadeMs = 0 } = options;
        await Promise.all([...this.tracks].filter((t) => t.key !== key).map((t) => this.release(t, fadeMs)));
    }

    /** 次に鳴らす曲を、先に読み込んでおく(失敗しても何もしない)。同じ key の `play` が使う。 */
    async preload(src: SoundSource): Promise<void> {
        if (this.preloaded.has(src.key) || [...this.tracks].some((t) => t.key === src.key)) return;
        const loading = this.load(src).catch((error) => {
            console.warn(`[Sound:${this.name}] failed to preload`, src.key, error);
            return null;
        });
        this.preloaded.set(src.key, loading);
        await loading;
    }

    /** 鳴っているすべての曲を、`fadeMs` かけてフェードアウトして一時停止する。`resume` で止めた位置から続く。 */
    suspend(fadeMs = 0): Promise<void> {
        const targets = [...this.tracks].filter((t) => t.status === "playing" && t.id);
        for (const t of targets) t.status = "paused";
        if (targets.length > 0) this.emit();
        const work = Promise.all(
            targets.map((t) =>
                this.backend.pause(t.id!, fadeMs).catch((error) => console.warn(`[Sound:${this.name}] failed to pause`, t.key, error))
            )
        ).then(() => undefined);
        this.suspending = this.suspending.then(() => work);
        return work;
    }

    /** 一時停止中の曲を、止めた位置から続けて鳴らす(`fadeMs` かけてフェードイン)。 */
    async resume(fadeInMs = 0): Promise<void> {
        await this.suspending;
        const parked = [...this.tracks].filter((t) => t.status === "paused" && !t.cancelled && t.id);
        for (const t of parked) {
            t.status = "playing";
            this.backend.play(t.id!, fadeInMs, t.loop, () => this.onEnded(t)).catch((error) => {
                console.warn(`[Sound:${this.name}] failed to resume`, t.key, error);
                if (!t.cancelled) void this.release(t, 0);
            });
        }
        if (parked.length > 0) this.emit();
    }

    /** すべて止め、先読みも捨てる。 */
    async dispose(): Promise<void> {
        await this.stop();
        for (const loading of this.preloaded.values()) void loading.then((id) => id && this.backend.disposeInstance(id));
        this.preloaded.clear();
    }

    /** 先読みの結果があればそれを使い、なければ読み込む。 */
    private async acquire(src: SoundSource): Promise<string> {
        const cached = this.preloaded.get(src.key);
        if (cached) {
            this.preloaded.delete(src.key);
            const id = await cached;
            if (id) return id;
        }
        return this.load(src);
    }

    private async load(src: SoundSource): Promise<string> {
        return this.backend.loadFromBlob(await src.load());
    }

    /** 曲が自然に終わった。まだ一覧にあれば外して片づける。 */
    private onEnded(track: Track): void {
        if (!this.tracks.has(track)) return;
        this.tracks.delete(track);
        if (track.id) this.backend.disposeInstance(track.id);
        this.emit();
    }

    /** 曲を一覧から外し、止めて片づける。読み込み・待ちの途中なら、そのあと鳴らさない。失敗しても例外にしない。 */
    private async release(track: Track, fadeMs: number): Promise<void> {
        if (!this.tracks.delete(track)) return;
        track.cancelled = true;
        track.wake?.();
        this.emit();
        const { id, status } = track;
        if (!id) return; // 読み込み中。届いたとき、play が捨てる
        try {
            if (status === "playing") await this.backend.stop(id, Math.max(0, Math.round(fadeMs)));
        } catch (error) {
            console.warn(`[Sound:${this.name}] failed to stop`, track.key, error);
        } finally {
            this.backend.disposeInstance(id);
        }
    }
}

/** ゲームに入るとき、場内BGMを一時停止するフェード(ミリ秒)と、出るときの再開のフェード。 */
export const VENUE_SUSPEND_FADE_MS = 1000;

/** 音の中心。`venue` / `screen` / `effect` の3チャンネルと、自動再生の制限の解除を持つ。 */
export class SoundSystem {
    readonly venue: SoundChannel;
    readonly screen: SoundChannel;
    readonly effect: SoundChannel;
    /** いまスクリーンに出ている動画の、音の通り道での ID。 */
    private videoId: string | null = null;

    constructor(private readonly backend: SoundBackend) {
        this.venue = new SoundChannel("venue", { exclusive: false, sameKey: "replace" }, backend);
        this.screen = new SoundChannel("screen", { exclusive: true, sameKey: "keep" }, backend);
        this.effect = new SoundChannel("effect", { exclusive: false, sameKey: "overlap" }, backend);
    }

    /** 音を出せる状態か(`running`)。ブラウザの自動再生の制限の間は `suspended`。 */
    get audioState(): AudioContextState {
        return this.backend.state;
    }

    /** 自動再生の制限を解除する。クリックなどの利用者の操作の中で呼ぶ。解除できなくても例外にしない。 */
    unlock(): Promise<void> {
        return this.backend.unlock();
    }

    /** `audioState` が変わったら知らせる。戻り値は解除関数。 */
    onAudioStateChange(listener: () => void): () => void {
        return this.backend.onStateChange(listener);
    }

    /** ゲームに入った。場内BGMを一時停止する。 */
    enterGame(): Promise<void> {
        return this.venue.suspend(VENUE_SUSPEND_FADE_MS);
    }

    /** ゲームを出た。画面のBGMと効果音を止め、場内BGMを続きから再開する。 */
    async leaveGame(): Promise<void> {
        void this.screen.stop();
        void this.effect.stop();
        await this.venue.resume(VENUE_SUSPEND_FADE_MS);
    }

    /** スクリーンの動画が出ているか。 */
    get videoActive(): boolean {
        return this.videoId !== null;
    }

    /**
     * スクリーンの動画の音を、音の通り道に組み込む。動画は同時に1つだけで、前の動画は外す。
     * 動画の要素ごとに1回だけ呼ぶこと(同じ要素を2回組み込むとブラウザが拒む)。組み込めなくても例外にしない(動画は要素のまま鳴る)。
     */
    attachVideo(element: HTMLMediaElement): void {
        this.detachVideo();
        try {
            this.videoId = this.backend.attachElement(element);
        } catch (error) {
            console.warn("[Sound:video] failed to attach", error);
        }
        void this.backend.unlock(); // 利用者の操作の外では解除できないことがある。そのときは案内(自動再生の解除)に任せる
    }

    /** 動画を外す(画面を離れた・別の動画に替わった)。フェード中なら、そこで終わる。 */
    detachVideo(): void {
        if (this.videoId === null) return;
        this.backend.detachElement(this.videoId);
        this.videoId = null;
    }

    /** 動画の音を、`ms` ミリ秒かけて 0 まで下げる。動画が出ていなければ、すぐ終わる。 */
    fadeOutVideo(ms: number): Promise<void> {
        if (this.videoId === null || ms <= 0) return Promise.resolve();
        return this.backend.fadeOutElement(this.videoId, ms);
    }

    /** 全チャンネルと動画の状態(テストで読む)。動画の音量は、出ていなければ null。 */
    snapshot(): { audio: AudioContextState; venue: ChannelState; screen: ChannelState; effect: ChannelState; video: { gain: number } | null } {
        return {
            audio: this.audioState,
            venue: this.venue.state,
            screen: this.screen.state,
            effect: this.effect.state,
            video: this.videoId === null ? null : { gain: this.backend.getElementGain(this.videoId) },
        };
    }
}
