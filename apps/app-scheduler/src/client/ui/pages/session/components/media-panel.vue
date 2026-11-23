<template>
    <section class="media" data-testid="media-panel">
        <div class="media__head">
            <h2 class="media__h2">音楽・スクリーン</h2>
            <UiButton size="sm" :loading="loading" data-testid="media-reload" @click="load">再読み込み</UiButton>
        </div>

        <!-- いま流れている/映っているもの。ホストが実際に出しているものを表示するだけ(送った指示から推測しない) -->
        <div class="media__now" data-testid="media-now">
            <h3 class="media__h3">いま流れている・映っているもの</h3>
            <ul class="media__list">
                <li v-for="row in now.audio" :key="row.assetId" class="media__row" data-testid="media-now-audio">
                    <span class="media__name">🎵 {{ row.name }}<span v-if="row.loop" class="media__badge" data-testid="media-now-loop">ループ</span></span>
                    <UiButton size="sm" :disabled="!canSend || busy !== null" :loading="busy === `stop:${row.assetId}`"
                        :data-testid="`media-now-stop-${row.assetId}`" @click="stopSong(row.assetId)">停止</UiButton>
                </li>
                <li v-if="now.screen" class="media__row" data-testid="media-now-screen">
                    <span class="media__name">{{ SCREEN_ICONS[now.screen.kind] }} {{ now.screen.kindLabel }}: {{ now.screen.name }}</span>
                    <UiButton size="sm" :disabled="!canSend || busy !== null" :loading="busy === 'clear'"
                        data-testid="media-now-clear" @click="clearScreen">消す</UiButton>
                </li>
            </ul>
            <p v-if="now.audio.length === 0" class="media__sub" data-testid="media-now-audio-none">音楽: なし</p>
            <p v-if="!now.screen" class="media__sub" data-testid="media-now-screen-none">スクリーン: なし</p>
        </div>

        <div class="media__tabs" role="tablist">
            <button type="button" role="tab" class="media__tab" :class="{ 'is-active': tab === 'audio' }" :aria-selected="tab === 'audio'"
                data-testid="media-tab-audio" @click="tab = 'audio'">音楽</button>
            <button type="button" role="tab" class="media__tab" :class="{ 'is-active': tab === 'screen' }" :aria-selected="tab === 'screen'"
                data-testid="media-tab-screen" @click="tab = 'screen'">スクリーン</button>
        </div>

        <label class="media__field media__fade">
            <span>フェードアウトの秒数(停止・すべて停止・消す・再生し直しで使う。0 で即時)</span>
            <input v-model.number="fadeSec" type="number" min="0" :max="MAX_FADE_SEC" step="0.5" data-testid="media-fade-sec" />
        </label>

        <p v-if="loadError" class="media__sub is-warn" role="alert" data-testid="media-error">素材の一覧を取得できませんでした。「再読み込み」を押してください。</p>
        <p v-if="playbackError" class="media__sub is-warn" role="alert" data-testid="media-playback-error">ホストで再生・表示できませんでした: {{ playbackError }}</p>
        <p v-if="truncated > 0" class="media__sub is-warn" data-testid="media-truncated">ホストにだけある素材のうち {{ truncated }} 件は、一覧に載せきれていません(アップロードが終わると出ます)。</p>

        <!-- 音楽 -->
        <div v-if="tab === 'audio'" class="media__body" data-testid="media-audio">
            <p v-if="!loading && !loadError && songs.length === 0" class="media__sub">音楽の素材がありません。設定の「アセット」で登録してください。</p>
            <label class="media__check">
                <input v-model="loop" type="checkbox" data-testid="media-loop" />
                <span>ループ(停止するまで繰り返す)</span>
            </label>
            <ul class="media__list">
                <li v-for="song in songs" :key="song.id" class="media__row" data-testid="media-song">
                    <span class="media__name">{{ song.name }}<span v-if="playingIds.has(song.id)" class="media__badge is-on" data-testid="media-song-playing">再生中</span></span>
                    <span class="media__actions">
                        <UiButton size="sm" variant="primary" :disabled="!canSend || busy !== null" :loading="busy === `play:${song.id}`"
                            :data-testid="`media-play-${song.id}`" @click="playSong(song.id)">再生</UiButton>
                        <UiButton size="sm" :disabled="!canSend || busy !== null" :loading="busy === `stop:${song.id}`"
                            :data-testid="`media-stop-${song.id}`" @click="stopSong(song.id)">停止</UiButton>
                    </span>
                </li>
            </ul>
            <UiButton variant="danger" :disabled="!canSend || busy !== null" :loading="busy === 'stop-all'" data-testid="media-stop-all" @click="stopAll">すべて停止</UiButton>
        </div>

        <!-- スクリーン -->
        <div v-else class="media__body" data-testid="media-screen">
            <p v-if="!loading && !loadError && visuals.length === 0" class="media__sub">画像・動画の素材がありません。設定の「アセット」で登録してください。</p>
            <ul class="media__list">
                <li v-for="item in visuals" :key="item.id" class="media__row" data-testid="media-visual">
                    <span class="media__name">{{ item.kind === 'video' ? '🎞️' : '🖼️' }} {{ item.name }}</span>
                    <UiButton size="sm" variant="primary" :disabled="!canSend || busy !== null" :loading="busy === `show:${item.id}`"
                        :data-testid="`media-show-${item.id}`" @click="showItem(item)">表示</UiButton>
                </li>
            </ul>

            <div class="media__slideshow" data-testid="media-slideshow">
                <h3 class="media__h3">スライドショー</h3>
                <label class="media__field">フォルダ
                    <select v-model="folderChoice" data-testid="media-folder-select">
                        <option value="">{{ folders.length === 0 ? '(一覧にフォルダがありません)' : '選んでください' }}</option>
                        <option v-for="f in folders" :key="f" :value="f">{{ f }}</option>
                    </select>
                </label>
                <label class="media__field">フォルダ名を入力(一覧に無いとき)
                    <input v-model="folderInput" type="text" autocomplete="off" :maxlength="MAX_FOLDER_LENGTH" placeholder="slideshow-1" data-testid="media-folder-input" />
                </label>
                <div class="media__inline">
                    <label class="media__field">1枚の秒数
                        <input v-model.number="intervalSec" type="number" :min="COMMAND_MIN_INTERVAL_SEC" :max="COMMAND_MAX_INTERVAL_SEC" data-testid="media-interval" />
                    </label>
                    <label class="media__field">切替
                        <select v-model="transition" data-testid="media-transition">
                            <option value="fade">フェード</option>
                            <option value="slide">スライド</option>
                        </select>
                    </label>
                </div>
                <UiButton variant="primary" :disabled="!canSend || busy !== null || !slideshowSpec" :loading="busy === 'slideshow'"
                    data-testid="media-slideshow-start" @click="startSlideshow">スライドショーを開始</UiButton>
            </div>

            <UiButton variant="danger" :disabled="!canSend || busy !== null" :loading="busy === 'clear'" data-testid="media-clear" @click="clearScreen">消す</UiButton>
        </div>
    </section>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import { container } from 'tsyringe';
import { UiButton, toast } from '@octopus/ui-kit';
import { parseHubErrorCode, stripHubErrorCode } from '@octopus/session-hub';
import type { SessionConnection } from '@octopus/session-hub';
import type { DriveMetadata } from '@octopus/infrastructures/compositions';
import { AssetRepository } from '@model/asset/asset-repository';
import { COMMAND_MAX_INTERVAL_SEC, COMMAND_MIN_INTERVAL_SEC, DEFAULT_FADE_SEC, MAX_FADE_SEC, MAX_FOLDER_LENGTH, MEDIA_NS, parseMediaCommand } from '../../../../model/media/media-command';
import { listFolders, mergeCatalog, readMediaSlice, toCatalog, type CatalogItem } from '../../../../model/media/media-catalog';
import { describeNowPlaying, readPlaybackSlice, readSessionPath, screenFromPath } from '../../../../model/media/now-playing';
import type { ScreenSpec } from '../../../../model/media/screen-spec';
import { useBusy } from '../use-busy';

/**
 * 管理端末の「音楽・スクリーン」。ホストへ `media` の指示(再生・停止・表示・消す)を送る。
 * ホストで何が鳴っている・映っているかは、この欄では持たず、ホストが公開した状態(`playback` と `session.path`)を表示するだけ。一覧は、サーバーの一覧(素材の本体を取らない)に、
 * ホストが公開した差(アップロード前の素材、ホストで消した素材)を合わせて作る。
 * ホストの公開する番号(`rev`)が変わったら、サーバーの一覧を読み直す。
 */
const props = defineProps<{
    connection: SessionConnection;
    canSend: boolean;
    /** 素材の一覧(メタデータ)の取得。省略するとサーバーから取る。 */
    loadMetas?: () => Promise<DriveMetadata[]>;
    /** ルーム状態の `data`。ホストが公開した `media`(素材の一覧の差と再生の失敗)を読む。 */
    roomData?: Record<string, unknown> | null;
}>();

const tab = ref<'audio' | 'screen'>('audio');
const remote = ref<CatalogItem[]>([]);
const slice = computed(() => readMediaSlice(props.roomData));
const catalog = computed(() => mergeCatalog(remote.value, slice.value));
const truncated = computed(() => slice.value?.truncated ?? 0);

/** ホストが公開した「いま鳴っている曲」(`playback`)と、いまの画面(`session.path`)から導いたスクリーン。 */
const now = computed(() => describeNowPlaying(readPlaybackSlice(props.roomData), screenFromPath(readSessionPath(props.roomData)), catalog.value));
const playingIds = computed(() => new Set(now.value.audio.map((row) => row.assetId)));
const SCREEN_ICONS = { image: '🖼️', video: '🎞️', slideshow: '🎬' } as const;

/** 再生の失敗は、この端末が次の指示を送るまで見せる(古い失敗を、ずっと出さないため)。開いた時点の失敗は見せない。 */
const acknowledgedErrorAt = ref(slice.value?.lastError?.at ?? 0);
const playbackError = computed(() => {
    const error = slice.value?.lastError;
    if (!error || error.at === acknowledgedErrorAt.value) return '';
    return catalog.value.find((i) => i.id === error.assetId)?.name ?? error.assetId;
});
const loading = ref(false);
const loadError = ref(false);

/** 「再生」をループにするか。止めるのは、これまでどおり「停止」。 */
const loop = ref(false);
const folderChoice = ref('');
const folderInput = ref('');
const intervalSec = ref(5);
const transition = ref<'fade' | 'slide'>('fade');

/** フェードアウトの秒数。この端末の便利設定として、localStorage に残す(読み書きできなくても動く)。 */
const FADE_STORAGE_KEY = 'media-panel.fadeSec';
function readStoredFade(): number {
    try {
        const stored = localStorage.getItem(FADE_STORAGE_KEY);
        if (stored === null) return DEFAULT_FADE_SEC;
        const value = Number(stored);
        return Number.isFinite(value) && value >= 0 && value <= MAX_FADE_SEC ? value : DEFAULT_FADE_SEC;
    } catch {
        return DEFAULT_FADE_SEC;
    }
}
const fadeSec = ref(readStoredFade());
/** 入力欄の値を、送れる範囲(0〜`MAX_FADE_SEC`)に収めた秒数。空や数でない入力は既定に戻す。 */
const effectiveFadeSec = computed(() => {
    const value = Number(fadeSec.value);
    return Number.isFinite(value) && fadeSec.value !== ('' as unknown) ? Math.min(MAX_FADE_SEC, Math.max(0, value)) : DEFAULT_FADE_SEC;
});
watch(effectiveFadeSec, (value) => {
    try {
        localStorage.setItem(FADE_STORAGE_KEY, String(value));
    } catch {
        // 保存できなくても、そのまま使える
    }
});

function reportError(e: unknown) {
    const message = e instanceof Error ? e.message : String(e);
    toast.error(parseHubErrorCode(message) ? stripHubErrorCode(message) : `送信できませんでした。通信状況を確認してください(${message})`);
}
const { busy, run } = useBusy<string>(reportError);

const songs = computed(() => catalog.value.filter((i) => i.kind === 'audio'));
const visuals = computed(() => catalog.value.filter((i) => i.kind === 'image' || i.kind === 'video'));
const folders = computed(() => listFolders(catalog.value));

/** いまの入力から作るスライドショーの指定。入力が正しくなければ null(ボタンを押せない)。 */
const slideshowSpec = computed<ScreenSpec | null>(() => {
    const spec = { kind: 'slideshow', folder: (folderInput.value.trim() || folderChoice.value).trim(), intervalSec: intervalSec.value, transition: transition.value };
    const parsed = parseMediaCommand('show', { spec });
    return parsed?.type === 'show' ? parsed.spec : null;
});

let reloadRequested = false;
async function load() {
    // 読み込み中にまた呼ばれたら、終わってからもう1回だけ読む(最新のサーバーの一覧にするため)
    if (loading.value) {
        reloadRequested = true;
        return;
    }
    loading.value = true;
    loadError.value = false;
    try {
        const metas = props.loadMetas
            ? await props.loadMetas()
            : await container.resolve(AssetRepository).listRemote();
        remote.value = toCatalog(metas);
    } catch (e) {
        console.warn('素材の一覧を取得できませんでした', e);
        loadError.value = true;
    } finally {
        loading.value = false;
    }
    if (reloadRequested) {
        reloadRequested = false;
        await load();
    }
}

const send = (key: string, type: string, payload?: unknown) => {
    acknowledgedErrorAt.value = slice.value?.lastError?.at ?? 0;
    return run(key, async () => { await props.connection.issue(MEDIA_NS, type, payload); });
};

// ホストの素材の一覧かサーバーとの同期が変わったら(アップロードが済んだ、など)、サーバーの一覧を読み直す。「再読み込み」を押さなくてよい。
watch(() => slice.value?.rev, (rev, previous) => {
    if (rev !== previous) void load();
});

const playSong = (id: string) => send(`play:${id}`, 'play', { assetId: id, ...(loop.value ? { loop: true } : {}), fadeSec: effectiveFadeSec.value });
const stopSong = (id: string) => send(`stop:${id}`, 'stop', { assetId: id, fadeSec: effectiveFadeSec.value });
const stopAll = () => send('stop-all', 'stop', { fadeSec: effectiveFadeSec.value });
const showItem = (item: CatalogItem) => send(`show:${item.id}`, 'show', { spec: { kind: item.kind === 'video' ? 'video' : 'image', id: item.id } });
const startSlideshow = () => (slideshowSpec.value ? send('slideshow', 'show', { spec: slideshowSpec.value }) : Promise.resolve(false));
const clearScreen = () => send('clear', 'clear', { fadeSec: effectiveFadeSec.value });

onMounted(load);
</script>

<style scoped>
.media { display: flex; flex-direction: column; gap: 8px; }
.media__head { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
.media__h2 { margin: 8px 0; font-size: 1rem; }
.media__h3 { margin: 8px 0 4px; font-size: 0.9rem; opacity: 0.8; }
.media__tabs { display: flex; gap: 4px; }
.media__tab { flex: 1; min-height: 44px; font: inherit; border-radius: 8px; border: 1px solid var(--ui-border, #3a4048); background: var(--ui-surface, #2b3036); color: inherit; cursor: pointer; }
.media__tab.is-active { border-color: currentColor; font-weight: 700; }
.media__body { display: flex; flex-direction: column; gap: 10px; }
.media__sub { margin: 4px 0 0; font-size: 0.85rem; opacity: 0.75; }
.media__sub.is-warn { color: #ffb300; opacity: 1; }
.media__list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 6px; max-height: 320px; overflow-y: auto; }
.media__row { display: flex; align-items: center; justify-content: space-between; gap: 8px; background: var(--ui-surface, #2b3036); border-radius: 8px; padding: 6px 10px; }
.media__name { flex: 1 1 auto; min-width: 0; overflow-wrap: anywhere; }
.media__actions { display: flex; gap: 6px; flex: 0 0 auto; }
.media__slideshow { display: flex; flex-direction: column; gap: 8px; background: var(--ui-surface, #2b3036); border-radius: 10px; padding: 10px 12px; }
.media__field { display: flex; flex-direction: column; gap: 4px; font-size: 0.85rem; min-width: 0; }
.media__inline .media__field { flex: 1 1 8em; }
.media__field select, .media__field input { font: inherit; padding: 8px; border-radius: 6px; background: var(--ui-bg, #23252b); color: inherit; border: 1px solid var(--ui-border, #3a4048); min-width: 0; width: 100%; box-sizing: border-box; }
.media__now { display: flex; flex-direction: column; gap: 6px; background: var(--ui-surface, #2b3036); border-radius: 10px; padding: 8px 12px; }
.media__now .media__h3 { margin: 0; }
.media__now .media__row { background: var(--ui-bg, #23252b); }
.media__badge { margin-left: 8px; padding: 1px 8px; border-radius: 999px; font-size: 0.75rem; border: 1px solid currentColor; opacity: 0.85; white-space: nowrap; }
.media__badge.is-on { color: #66bb6a; opacity: 1; }
.media__fade input { max-width: 8em; }
.media__check { display: flex; align-items: center; gap: 8px; min-height: 44px; cursor: pointer; }
.media__inline { display: flex; flex-wrap: wrap; gap: 8px; }
</style>
