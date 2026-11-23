import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { FakeSoundBackend } from "./fake-sound-backend";
import { SoundSystem, VENUE_SUSPEND_FADE_MS } from "./sound-system";
import type { SoundSource } from "./sound-system";

const src = (key: string, size = 1): SoundSource => ({ key, load: async () => new Blob([new Uint8Array(size)]) });

let backend: FakeSoundBackend;
let sound: SoundSystem;
beforeEach(() => {
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    backend = new FakeSoundBackend();
    sound = new SoundSystem(backend);
});
afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
});

describe("screen: 同じ key なら流し続け、違えば切り替える", () => {
    it("鳴らすと、key と再生中の状態が読める", async () => {
        expect(await sound.screen.play(src("a"), { loop: true })).toBe("started");
        expect(sound.screen.state).toEqual({ current: "a", tracks: [{ key: "a", status: "playing", loop: true, currentTime: 0, gain: 1 }] });
    });

    it("同じ key をもう一度鳴らしても、何もしない(読み込みも、鳴らし直しもしない)", async () => {
        await sound.screen.play(src("a"), { loop: true });
        const calls = [...backend.calls];
        expect(await sound.screen.play(src("a"), { loop: true })).toBe("kept");
        expect(backend.calls).toEqual(calls);
        expect(sound.screen.state.tracks).toHaveLength(1);
    });

    it("読み込み中に同じ key が来ても、2つ目は何もしない(1曲だけ鳴る)", async () => {
        let release: () => void = () => undefined;
        backend.holdLoad = new Promise<void>((resolve) => (release = resolve));
        const first = sound.screen.play(src("a"));
        expect(sound.screen.state.tracks).toMatchObject([{ key: "a", status: "loading" }]);
        expect(await sound.screen.play(src("a"))).toBe("kept");
        release();
        expect(await first).toBe("started");
        expect(backend.playingIds).toHaveLength(1);
    });

    it("違う key なら、前の曲を止め(すぐ止めて破棄)、新しい曲を鳴らす", async () => {
        await sound.screen.play(src("a"));
        const [first] = backend.playingIds;
        expect(await sound.screen.play(src("b"))).toBe("started");
        expect(sound.screen.state.tracks.map((t) => t.key)).toEqual(["b"]);
        await vi.waitFor(() => expect(backend.alive).not.toContain(first));
        expect(backend.calls).toContain(`stop:${first}:fade=0`);
        expect(backend.playingIds).toHaveLength(1);
    });

    it("置き換えるときのフェードアウトの長さを指定できる", async () => {
        await sound.screen.play(src("a"));
        const [first] = backend.playingIds;
        await sound.screen.play(src("b"), { replaceFadeMs: 800 });
        expect(backend.calls).toContain(`stop:${first}:fade=800`);
    });

    it("stopUnless: その key 以外を止め、その key は触らない。読み込み中の別の曲は、鳴らさない", async () => {
        await sound.screen.play(src("a"));
        const before = [...backend.calls];
        await sound.screen.stopUnless("a");
        expect(backend.calls).toEqual(before);

        let release: () => void = () => undefined;
        backend.holdLoad = new Promise<void>((resolve) => (release = resolve));
        await sound.screen.stop();
        const pending = sound.screen.play(src("b"));
        await sound.screen.stopUnless("a"); // 行き先の曲は a。読み込み中の b は取りやめる
        release();
        expect(await pending).toBe("cancelled");
        expect(backend.playingIds).toEqual([]);
        expect(backend.alive).toEqual([]);
    });

    it("stop: 鳴っている曲を止めて破棄し、状態が空になる", async () => {
        await sound.screen.play(src("a"));
        await sound.screen.stop({ fadeMs: 300 });
        expect(sound.screen.state).toEqual({ current: null, tracks: [] });
        expect(backend.alive).toEqual([]);
        expect(backend.calls.some((c) => c.endsWith("fade=300"))).toBe(true);
    });

    it("曲が自然に終わると、状態から消え、破棄される", async () => {
        await sound.screen.play(src("a"));
        backend.end(backend.playingIds[0]);
        expect(sound.screen.state.tracks).toEqual([]);
        expect(backend.alive).toEqual([]);
    });

    it("経過時間とゲインを、状態から読める", async () => {
        await sound.screen.play(src("a"), { fadeInMs: 500 });
        backend.advance(2.5);
        expect(sound.screen.state.tracks[0]).toMatchObject({ currentTime: 2.5, gain: 0 });
    });
});

describe("play: 取りやめ・遅らせる・失敗", () => {
    it("signal で、読み込み中の再生を取りやめる(鳴らさず、破棄する)", async () => {
        let release: () => void = () => undefined;
        backend.holdLoad = new Promise<void>((resolve) => (release = resolve));
        const controller = new AbortController();
        const pending = sound.screen.play(src("a"), { signal: controller.signal });
        controller.abort();
        release();
        expect(await pending).toBe("cancelled");
        expect(sound.screen.state.tracks).toEqual([]);
        expect(backend.playingIds).toEqual([]);
        expect(backend.alive).toEqual([]);
    });

    it("すでに中止された signal なら、読み込みもしない", async () => {
        const load = vi.fn(async () => new Blob());
        expect(await sound.screen.play({ key: "a", load }, { signal: AbortSignal.abort() })).toBe("cancelled");
        expect(load).not.toHaveBeenCalled();
    });

    it("鳴り始めたあとの signal の中止では、止めない", async () => {
        const controller = new AbortController();
        await sound.screen.play(src("a"), { signal: controller.signal });
        controller.abort();
        expect(backend.playingIds).toHaveLength(1);
    });

    it("delayMs だけ待ってから鳴らす。待っている間に止めると、鳴らさない", async () => {
        vi.useFakeTimers();
        const later = sound.screen.play(src("a"), { delayMs: 1200 });
        await vi.advanceTimersByTimeAsync(1000);
        expect(backend.playingIds).toEqual([]);
        await vi.advanceTimersByTimeAsync(300);
        expect(await later).toBe("started");

        await sound.screen.stop();
        const cancelled = sound.screen.play(src("b"), { delayMs: 1200 });
        await vi.advanceTimersByTimeAsync(500);
        await sound.screen.stop();
        expect(await cancelled).toBe("cancelled");
        await vi.advanceTimersByTimeAsync(2000);
        expect(backend.playingIds).toEqual([]);
        expect(backend.alive).toEqual([]);
    });

    it("古い再生の結果は捨てる: 読み込みが遅い a が、あとから来た b を止めたり、重なって鳴ったりしない", async () => {
        let release: () => void = () => undefined;
        backend.holdLoad = new Promise<void>((resolve) => (release = resolve));
        const a = sound.screen.play(src("a"));
        const b = sound.screen.play(src("b"));
        release();
        expect(await a).toBe("cancelled");
        expect(await b).toBe("started");
        expect(sound.screen.state.tracks.map((t) => t.key)).toEqual(["b"]);
        expect(backend.playingIds).toHaveLength(1);
        expect(backend.alive).toHaveLength(1);
    });

    it("読み込み・再生に失敗しても、例外にせず、一覧に残さない", async () => {
        expect(await sound.screen.play({ key: "a", load: async () => Promise.reject(new Error("no blob")) })).toBe("failed");
        expect(sound.screen.state.tracks).toEqual([]);
        backend.failPlay = true;
        expect(await sound.screen.play(src("b"))).toBe("started"); // 鳴らす処理は待たない
        await vi.waitFor(() => expect(sound.screen.state.tracks).toEqual([]));
        expect(backend.alive).toEqual([]);
    });

    it("preload した曲は、同じ key の play が読み込み直さずに使う", async () => {
        const load = vi.fn(async () => new Blob([new Uint8Array(2)]));
        await sound.screen.preload({ key: "a", load });
        await sound.screen.play({ key: "a", load });
        expect(load).toHaveBeenCalledTimes(1);
        expect(backend.playingIds).toHaveLength(1);
        // 先読みに失敗しても、play は自分で読み込む
        const flaky = vi.fn().mockRejectedValueOnce(new Error("x")).mockResolvedValue(new Blob([new Uint8Array(1)]));
        await sound.screen.preload({ key: "b", load: flaky });
        expect(await sound.screen.play({ key: "b", load: flaky })).toBe("started");
    });
});

describe("venue: 場内BGM", () => {
    it("違う曲は重ねて鳴らし、1曲だけ止められる", async () => {
        await sound.venue.play(src("a"), { loop: true });
        await sound.venue.play(src("b"));
        expect(sound.venue.state.tracks.map((t) => t.key)).toEqual(["a", "b"]);
        await sound.venue.stop({ key: "a", fadeMs: 2000 });
        expect(sound.venue.state.tracks.map((t) => t.key)).toEqual(["b"]);
        expect(backend.playingIds).toHaveLength(1);
    });

    it("同じ曲をもう一度鳴らすと、古い方をフェードアウトしながら新しい方を鳴らす(クロスフェード)", async () => {
        await sound.venue.play(src("a"));
        const [first] = backend.playingIds;
        await sound.venue.play(src("a"), { replaceFadeMs: 2000 });
        expect(backend.calls).toContain(`stop:${first}:fade=2000`);
        expect(sound.venue.state.tracks).toHaveLength(1);
        expect(backend.playingIds).toHaveLength(1);
        expect(backend.playingIds[0]).not.toBe(first);
    });

    it("ゲームに入ると一時停止し(1秒のフェード)、出ると同じ位置から再開する", async () => {
        await sound.venue.play(src("a"), { loop: true });
        const [id] = backend.playingIds;
        backend.advance(3);
        await sound.enterGame();
        expect(backend.calls).toContain(`pause:${id}:fade=${VENUE_SUSPEND_FADE_MS}`);
        expect(sound.venue.state.tracks).toMatchObject([{ key: "a", status: "paused", currentTime: 3 }]);
        expect(backend.playingIds).toEqual([]);

        backend.advance(10); // ゲーム中の時間は進まない
        await sound.leaveGame();
        expect(backend.calls).toContain(`play:${id}:fadeIn=${VENUE_SUSPEND_FADE_MS}:loop=true`);
        expect(sound.venue.state.tracks).toMatchObject([{ key: "a", status: "playing", currentTime: 3 }]);
    });

    it("一時停止中に止めると、再開されず破棄される", async () => {
        await sound.venue.play(src("a"));
        await sound.enterGame();
        await sound.venue.stop();
        await sound.leaveGame();
        expect(backend.playingIds).toEqual([]);
        expect(backend.alive).toEqual([]);
    });

    it("一覧の変化を subscribe で知らせる", async () => {
        const listener = vi.fn();
        const off = sound.venue.subscribe(listener);
        await sound.venue.play(src("a"));
        const count = listener.mock.calls.length;
        expect(count).toBeGreaterThan(0);
        off();
        await sound.venue.stop();
        expect(listener).toHaveBeenCalledTimes(count);
    });
});

describe("effect: 効果音", () => {
    it("同じ効果音も、重ねて鳴らせる。自然に終われば消える", async () => {
        await sound.effect.play(src("se"));
        await sound.effect.play(src("se"));
        expect(sound.effect.state.tracks).toHaveLength(2);
        backend.end(backend.playingIds[0]);
        expect(sound.effect.state.tracks).toHaveLength(1);
    });
});

describe("ゲームを出る", () => {
    it("画面のBGMと効果音を止める(場内BGMは再開する)", async () => {
        await sound.venue.play(src("v"));
        await sound.screen.play(src("s"));
        await sound.effect.play(src("e"));
        await sound.enterGame();
        await sound.leaveGame();
        expect(sound.screen.state.tracks).toEqual([]);
        expect(sound.effect.state.tracks).toEqual([]);
        expect(sound.venue.state.tracks).toMatchObject([{ key: "v", status: "playing" }]);
    });
});

describe("unlock", () => {
    it("自動再生の制限を解除し、状態の変化を知らせる。解除関数のあとは知らせない", async () => {
        expect(sound.audioState).toBe("suspended");
        const listener = vi.fn();
        const off = sound.onAudioStateChange(listener);
        await sound.unlock();
        expect(sound.audioState).toBe("running");
        expect(listener).toHaveBeenCalledOnce();
        off();
        backend.state = "suspended";
        await sound.unlock();
        expect(listener).toHaveBeenCalledOnce();
    });

    it("snapshot は、音の状態と全チャンネルの状態をまとめて返す", async () => {
        await sound.screen.play(src("a"));
        expect(sound.snapshot()).toMatchObject({ audio: "suspended", screen: { current: "a" }, venue: { current: null }, effect: { current: null } });
    });
});
