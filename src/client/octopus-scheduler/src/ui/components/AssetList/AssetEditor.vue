<template>
    <div>
        <h2>アセット編集画面</h2>
        <AssetTypeTabs :type="selectedType" @update:type="selectedType = $event" />
        <p>選択中: {{ selectedType }} アセット</p>
        <AssetList :type="selectedType" :assets="currentAssets" @add="showUploadDialog = true" @edit="onEdit"
            @delete="onDelete" />
        <AssetUploadDialog :visible="showUploadDialog" :type="selectedType" @submit="onUploadSubmit"
            @close="showUploadDialog = false" />
    </div>
</template>

<script setup lang="ts">

import AssetTypeTabs from './AssetTypeTabs.vue';
import AssetList from './AssetList.vue';
import AssetUploadDialog from './AssetUploadDialog.vue';
import { AudioService } from '../../../model/applications/assets/audio/audio-service';
import { ImageService } from '../../../model/applications/assets/image/image-service';
import { MovieService } from '../../../model/applications/assets/movie/movie-service';
import { ref, onMounted, computed } from 'vue';
import { AssetSyncService } from '../../../model/applications/assets/asset-sync-service';

import type { Audio } from '../../../model/domains/assets/audio/entity/audio';
import type { Image } from '../../../model/domains/assets/image/entity/image';
import type { Movie } from '../../../model/domains/assets/movie/entity/movie';
import { useLocalStorage } from '../../../../../packages/shared-composables/src';

type AssetType = 'Audio' | 'Image' | 'Movie';
type Asset = { id: string; name: string; data?: Blob };

interface AssetGetter<TEntity> {
    getAll(): Promise<TEntity[]>;
    getById(id: string): Promise<TEntity | null>;
    saveNew(name: string, blob: Blob): Promise<void>;
    delete(id: string): Promise<void>;
    idOf(entity: TEntity): string;
    nameOf(entity: TEntity): string;
    dataOf(entity: TEntity): Blob | undefined;
    rename(entity: TEntity, newName: string): void;
}

class AudioGetter implements AssetGetter<Audio> {
    private service = new AudioService();
    async getAll(): Promise<Audio[]> {
        return await this.service.getAllAudios();
    }
    getById(id: string) { return this.service.getAudioById(id); }
    saveNew(name: string, blob: Blob) { return this.service.addNewAudio(name, blob); }
    delete(id: string) { return this.service.deleteAudio(id); }
    idOf(entity: Audio) { return String(entity.audioId?.toString()); }
    nameOf(entity: Audio) { return entity.audioName; }
    dataOf(entity: Audio) { return entity.audioData; }
    rename(entity: Audio, newName: string) { entity.renameAudio(newName); }
}

class ImageGetter implements AssetGetter<Image> {
    private service = new ImageService();
    async getAll(): Promise<Image[]> { return await this.service.getAllImages(); }
    getById(id: string) { return this.service.getImageById(id); }
    saveNew(name: string, blob: Blob) { return this.service.saveNewImage(name, blob); }
    delete(id: string) { return this.service.deleteImage(id); }
    idOf(entity: Image) { return String(entity.imageId?.toString()); }
    nameOf(entity: Image) { return entity.imageName; }
    dataOf(entity: Image) { return entity.imageData; }
    rename(entity: Image, newName: string) { entity.renameImage(newName); }
}

class MovieGetter implements AssetGetter<Movie> {
    private service = new MovieService();
    async getAll(): Promise<Movie[]> { return await this.service.getAllMovies(); }
    getById(id: string) { return this.service.getMovieById(id); }
    saveNew(name: string, blob: Blob) { return this.service.saveNewMovie(name, blob); }
    delete(id: string) { return this.service.deleteMovie(id); }
    idOf(entity: Movie) { return String(entity.movieId?.toString()); }
    nameOf(entity: Movie) { return entity.movieName; }
    dataOf(entity: Movie) { return entity.movieData; }
    rename(entity: Movie, newName: string) { entity.renameMovie(newName); }
}

const selectedType = ref<AssetType>('Audio');
const showUploadDialog = ref(false);
const assets = ref<Record<AssetType, Asset[]>>({ Audio: [], Image: [], Movie: [] });
const { save, remove } = useLocalStorage();

type GetterMap = {
    Audio: AssetGetter<Audio>;
    Image: AssetGetter<Image>;
    Movie: AssetGetter<Movie>;
};

const assetGetters: GetterMap = {
    Audio: new AudioGetter(),
    Image: new ImageGetter(),
    Movie: new MovieGetter()
};

function getGetter<T extends AssetType>(type: T): GetterMap[T] {
    return assetGetters[type];
}

async function fetchAssets() {
    const newAssets: Record<AssetType, Asset[]> = { Audio: [], Image: [], Movie: [] };
    await Promise.all((Object.keys(assetGetters) as AssetType[]).map(async (type) => {
        try {
            const getter = getGetter(type);
            const arr = await getter.getAll();
            switch (type) {
                case 'Audio': {
                    const g = getter as AssetGetter<Audio>;
                    newAssets[type] = (arr as Audio[]).map(entity => ({
                        id: g.idOf(entity),
                        name: g.nameOf(entity),
                        data: g.dataOf(entity)
                    }));
                    await Promise.all((arr as Audio[]).map(entity => save(g.idOf(entity), entity)));
                    break;
                }
                case 'Image': {
                    const g = getter as AssetGetter<Image>;
                    newAssets[type] = (arr as Image[]).map(entity => ({
                        id: g.idOf(entity),
                        name: g.nameOf(entity),
                        data: g.dataOf(entity)
                    }));
                    await Promise.all((arr as Image[]).map(entity => save(g.idOf(entity), entity)));
                    break;
                }
                case 'Movie': {
                    const g = getter as AssetGetter<Movie>;
                    newAssets[type] = (arr as Movie[]).map(entity => ({
                        id: g.idOf(entity),
                        name: g.nameOf(entity),
                        data: g.dataOf(entity)
                    }));
                    await Promise.all((arr as Movie[]).map(entity => save(g.idOf(entity), entity)));
                    break;
                }
            }
        } catch (e) {
            alert(type + '取得失敗: ' + (e instanceof Error ? e.message : e));
        }
    }));
    assets.value = newAssets;
}

onMounted(async () => {
    await new AssetSyncService().syncAll();
    await fetchAssets();
});

const currentAssets = computed(() => assets.value[selectedType.value]);

async function onUploadSubmit({ name, file }: { name: string; file: File }) {
    const data = await file.arrayBuffer();
    const blob = new Blob([data], { type: file.type });
    try {
        await assetGetters[selectedType.value].saveNew(name, blob);
        await fetchAssets();
        showUploadDialog.value = false;
    } catch (e) {
        alert('追加失敗: ' + (e instanceof Error ? e.message : e));
    }
}

async function onEdit(asset: Asset) {
    const newName = window.prompt(`${selectedType.value}アセット名を編集`, asset.name);
    if (!newName || newName === asset.name) return;
    try {
        const type = selectedType.value;
        switch (type) {
            case 'Audio': {
                const g = getGetter('Audio');
                const entity = await g.getById(asset.id);
                if (!entity) throw new Error('エンティティ取得失敗');
                g.rename(entity, newName);
                const data = g.dataOf(entity);
                if (!data) throw new Error('エンティティのバイナリデータが見つかりません');
                await g.saveNew(newName, data);
                break;
            }
            case 'Image': {
                const g = getGetter('Image');
                const entity = await g.getById(asset.id);
                if (!entity) throw new Error('エンティティ取得失敗');
                g.rename(entity, newName);
                const data = g.dataOf(entity);
                if (!data) throw new Error('エンティティのバイナリデータが見つかりません');
                await g.saveNew(newName, data);
                break;
            }
            case 'Movie': {
                const g = getGetter('Movie');
                const entity = await g.getById(asset.id);
                if (!entity) throw new Error('エンティティ取得失敗');
                g.rename(entity, newName);
                const data = g.dataOf(entity);
                if (!data) throw new Error('エンティティのバイナリデータが見つかりません');
                await g.saveNew(newName, data);
                break;
            }
        }
        await fetchAssets();
    } catch (e) {
        alert('更新失敗: ' + (e instanceof Error ? e.message : e));
    }
}

async function onDelete(asset: Asset) {
    if (!window.confirm(`${asset.name} を削除しますか？`)) return;
    try {
        await assetGetters[selectedType.value].delete(asset.id);
        remove(asset.id);
        await fetchAssets();
    } catch (e) {
        alert('削除失敗: ' + (e instanceof Error ? e.message : e));
    }
}
</script>

<style scoped>
/* 必要に応じてスタイル追加 */
</style>
