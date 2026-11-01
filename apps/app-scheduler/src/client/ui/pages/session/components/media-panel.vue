<template>
    <section class="media" data-testid="media-panel">
        <div class="media__head">
            <h2 class="media__h2">音楽・スクリーン</h2>
            <UiButton size="sm" :loading="loading" data-testid="media-reload" @click="load">再読み込み</UiButton>
        </div>

        <div class="media__tabs" role="tablist">
            <button type="button" role="tab" class="media__tab" :class="{ 'is-active': tab === 'audio' }" :aria-selected="tab === 'audio'"
                data-testid="media-tab-audio" @click="tab = 'audio'">音楽</button>
            <button type="button" role="tab" class="media__tab" :class="{ 'is-active': tab === 'screen' }" :aria-selected="tab === 'screen'"
                data-testid="media-tab-screen" @click="tab = 'screen'">スクリーン</button>
        </div>

        <p v-if="loadError" class="media__sub is-warn" role="alert" data-testid="media-error">素材の一覧を取得できませんでした。「再読み込み」を押してください。</p>

        <!-- 音楽 -->
        <div v-if="tab === 'audio'" class="media__body" data-testid="media-audio">
            <p v-if="!loading && !loadError && songs.length === 0" class="media__sub">音楽の素材がありません。設定の「アセット」で登録してください。</p>
            <ul class="media__list">
                <li v-for="song in songs" :key="song.id" class="media__row" data-testid="media-song">
                    <span class="media__name">{{ song.name }}</span>
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
import { computed, onMounted, ref } from 'vue';
import { container } from 'tsyringe';
import { UiButton, toast } from '@octopus/ui-kit';
import { parseHubErrorCode, stripHubErrorCode } from '@octopus/session-hub';
import type { SessionConnection } from '@octopus/session-hub';
import type { DriveMetadata } from '@octopus/infrastructures/compositions';
import { IOctopusSchedulerApiToken } from '../../../../../server/scheduler-api-contract';
import type { OctopusSchedulerApi } from '../../../../../server/scheduler-api-contract';
import { COMMAND_MAX_INTERVAL_SEC, COMMAND_MIN_INTERVAL_SEC, MAX_FOLDER_LENGTH, MEDIA_NS, parseMediaCommand } from '../../../../model/media/media-command';
import { listFolders, toCatalog, type CatalogItem } from '../../../../model/media/media-catalog';
import type { ScreenSpec } from '../../../../model/media/screen-spec';
import { useBusy } from '../use-busy';

/**
 * 管理端末の「音楽・スクリーン」。ホストへ `media` の指示(再生・停止・表示・消す)を送るだけで、
 * ホストで何が鳴っている・映っているかは持たない。一覧は、素材の本体を取らない一覧の取得で作る。
 */
const props = defineProps<{
    connection: SessionConnection;
    canSend: boolean;
    /** 素材の一覧(メタデータ)の取得。省略するとサーバーから取る。 */
    loadMetas?: () => Promise<DriveMetadata[]>;
}>();

const tab = ref<'audio' | 'screen'>('audio');
const catalog = ref<CatalogItem[]>([]);
const loading = ref(false);
const loadError = ref(false);

const folderChoice = ref('');
const folderInput = ref('');
const intervalSec = ref(5);
const transition = ref<'fade' | 'slide'>('fade');

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

async function load() {
    loading.value = true;
    loadError.value = false;
    try {
        const metas = props.loadMetas
            ? await props.loadMetas()
            : (await container.resolve<OctopusSchedulerApi>(IOctopusSchedulerApiToken).getDriveMetaData(undefined)) || [];
        catalog.value = toCatalog(metas);
    } catch (e) {
        console.warn('素材の一覧を取得できませんでした', e);
        loadError.value = true;
    } finally {
        loading.value = false;
    }
}

const send = (key: string, type: string, payload?: unknown) => run(key, async () => { await props.connection.issue(MEDIA_NS, type, payload); });

const playSong = (id: string) => send(`play:${id}`, 'play', { assetId: id });
const stopSong = (id: string) => send(`stop:${id}`, 'stop', { assetId: id, fadeSec: 1 });
const stopAll = () => send('stop-all', 'stop', { fadeSec: 1 });
const showItem = (item: CatalogItem) => send(`show:${item.id}`, 'show', { spec: { kind: item.kind === 'video' ? 'video' : 'image', id: item.id } });
const startSlideshow = () => (slideshowSpec.value ? send('slideshow', 'show', { spec: slideshowSpec.value }) : Promise.resolve(false));
const clearScreen = () => send('clear', 'clear', {});

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
.media__inline { display: flex; flex-wrap: wrap; gap: 8px; }
</style>
