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
import { AudioService } from '../applications/assets/audio/audio-service';
import { ImageService } from '../applications/assets/image/image-service';
import { MovieService } from '../applications/assets/movie/movie-service';
import { ref, onMounted, computed } from 'vue';
import { useLocalStorage } from '../../../packages/shared-composables/src';
import { AssetSyncService } from '../applications/assets/asset-sync-service';


type AssetType = 'Audio' | 'Image' | 'Movie';
type Asset = { id: string; name: string; data?: Blob };


interface AssetGetter {
    getAll(): Promise<any[]>;
    getById(id: string): Promise<any>;
    saveNew(name: string, blob: Blob): Promise<void>;
    delete(id: string): Promise<void>;
    idKey: string;
    nameKey: string;
    dataKey: string;
    dataProp: string;
    rename(entity: any, newName: string): void;
}

class AudioGetter implements AssetGetter {
    private service = new AudioService();
    idKey = 'audioId';
    nameKey = 'audioName';
    dataKey = 'data';
    dataProp = 'audioData';
    getAll() {
        return new Promise<{ audioId: string; audioName: string; audioData?: Blob }[]>(async (resolve, reject) => {
            try {
                const audios = await this.service.getAllAudios();
                if (!audios) {
                    resolve([]);
                    return;
                }
                resolve(audios.map(audio => ({
                    audioId: String(audio.audioId),
                    audioName: audio.audioName,
                    data: audio.audioData
                })));
            } catch (e) {
                reject(e);
            }
        });
    }
    getById(id: string) { return this.service.getAudioById(id); }
    saveNew(name: string, blob: Blob) { return this.service.addNewAudio(name, blob); }
    delete(id: string) { return this.service.deleteAudio(id); }
    rename(entity: any, newName: string) { entity.rename(newName); }
}

class ImageGetter implements AssetGetter {
    private service = new ImageService();
    idKey = 'imageId';
    nameKey = 'imageName';
    dataKey = 'data';
    dataProp = 'imageData';
    getAll() {
        return new Promise<{ imageId: string; imageName: string; imageData?: Blob }[]>(async (resolve, reject) => {
            try {
                const images = await this.service.getAllImages();
                if (!images) {
                    resolve([]);
                    return;
                }
                resolve(images.map(image => ({
                    imageId: String(image.imageId),
                    imageName: image.imageName,
                    data: image.imageData
                })));
            } catch (e) {
                reject(e);
            }
        });
    }
    getById(id: string) { return this.service.getImageById(id); }
    saveNew(name: string, blob: Blob) { return this.service.saveNewImage(name, blob); }
    delete(id: string) { return this.service.deleteImage(id); }
    rename(entity: any, newName: string) { entity.rename(newName); }
}

class MovieGetter implements AssetGetter {
    private service = new MovieService();
    idKey = 'movieId';
    nameKey = 'movieName';
    dataKey = 'data';
    dataProp = 'movieData';
    getAll() {
        return new Promise<{ movieId: string; movieName: string; movieData?: Blob }[]>(async (resolve, reject) => {
            try {
                const movies = await this.service.getAllMovies();
                if (!movies) {
                    resolve([]);
                    return;
                }
                resolve(movies.map(movie => ({
                    movieId: String(movie.movieId),
                    movieName: movie.movieName,
                    data: movie.movieData
                })));
            } catch (e) {
                reject(e);
            }
        });
    }
    getById(id: string) { return this.service.getMovieById(id); }
    saveNew(name: string, blob: Blob) { return this.service.saveNewMovie(name, blob); }
    delete(id: string) { return this.service.deleteMovie(id); }
    rename(entity: any, newName: string) { entity.rename(newName); }
}

const selectedType = ref<AssetType>('Audio');
const showUploadDialog = ref(false);
const assets = ref<Record<AssetType, Asset[]>>({ Audio: [], Image: [], Movie: [] });
const { save, remove } = useLocalStorage();

const assetGetters: Record<AssetType, AssetGetter> = {
    Audio: new AudioGetter(),
    Image: new ImageGetter(),
    Movie: new MovieGetter()
};

async function fetchAssets() {
    const newAssets: Record<AssetType, Asset[]> = { Audio: [], Image: [], Movie: [] };
    await Promise.all((Object.keys(assetGetters) as AssetType[]).map(async (type) => {
        try {
            const getter = assetGetters[type];
            const arr = await getter.getAll();
            newAssets[type] = arr.map((a: any) => ({
                id: a[getter.idKey]?.id || a[getter.idKey],
                name: a[getter.nameKey],
                data: a[getter.dataKey]
            }));
            await Promise.all(arr.map((a: any) => save(a[getter.idKey]?.id || a[getter.idKey], a)));
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
        const getter = assetGetters[selectedType.value];
        const entity = await getter.getById(asset.id);
        if (!entity) throw new Error('エンティティ取得失敗');
        getter.rename(entity, newName);
        await getter.saveNew(newName, entity[getter.dataProp]);
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
