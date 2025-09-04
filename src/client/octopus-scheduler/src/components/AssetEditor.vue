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
import { ref, computed, onMounted, watch } from 'vue';
import { useLocalStorage } from '../../../packages/shared-composables/src/use-localstorage';
import { AudioService } from '../applications/assets/audio/audio-service';
import { ImageService } from '../applications/assets/image/image-service';
import { MovieService } from '../applications/assets/movie/movie-service';
import AssetList from "./AssetList.vue";
import AssetTypeTabs from "./AssetTypeTabs.vue";
import AssetUploadDialog from "./AssetUploadDialog.vue";

type AssetType = 'Audio' | 'Image' | 'Movie';
const selectedType = ref<AssetType>('Audio');
const showUploadDialog = ref(false);

type Asset = { id: string; name: string; data?: Blob };
const assets = ref<Record<AssetType, Asset[]>>({
    Audio: [],
    Image: [],
    Movie: []
});

const { save, remove } = useLocalStorage();

// assetsが更新されたらコンソール出力
watch(assets, (newVal) => {
    console.log('assets updated:', newVal);
});

// AssetTypeごとにapplication serviceを切り替え
const audioService = new AudioService();
const imageService = new ImageService();
const movieService = new MovieService();


// application service経由でアセット一覧を取得
async function fetchAssets() {
    const newAssets: Record<AssetType, Asset[]> = {
        Audio: [],
        Image: [],
        Movie: []
    };
    for (const type of ['Audio', 'Image', 'Movie'] as AssetType[]) {
        try {
            let arr: any[] = [];
            if (type === 'Audio') {
                arr = await audioService.getAllAudios();
                console.log('Audio assets:', arr);
                newAssets.Audio = arr.map((a: any) => ({
                    id: a.audioId?.id || a.audioId,
                    name: a.audioName,
                    data: a.data
                }));
                arr.forEach(async (a: any) => await save(a.audioId?.id || a.audioId, a));
            } else if (type === 'Image') {
                arr = await imageService.getAllImages();
                console.log('Image assets:', arr);
                newAssets.Image = arr.map((a: any) => ({
                    id: a.imageId?.id || a.imageId,
                    name: a.imageName,
                    data: a.data
                }));
                arr.forEach(async (a: any) => await save(a.imageId?.id || a.imageId, a));
            } else if (type === 'Movie') {
                arr = await movieService.getAllMovies();
                console.log('Movie assets:', arr);
                newAssets.Movie = arr.map((a: any) => ({
                    id: a.movieId?.id || a.movieId,
                    name: a.movieName,
                    data: a.data
                }));
                arr.forEach(async (a: any) => await save(a.movieId?.id || a.movieId, a));
            }
        } catch (e) {
            alert(type + '取得失敗: ' + (e instanceof Error ? e.message : e));
        }
    }
    console.log('Fetched assets:', newAssets);
    assets.value = newAssets;
    // currentAssetsの値を出力
    console.log('currentAssets:', assets.value[selectedType.value]);
}

onMounted(() => {
    fetchAssets();
});

const currentAssets = computed(() => assets.value[selectedType.value]);


// 1. 追加
async function onUploadSubmit({ name, file }: { name: string; file: File }) {
    const data = await file.arrayBuffer();
    const blob = new Blob([data], { type: file.type });
    try {
        if (selectedType.value === 'Audio') {
            await audioService.saveNewAudio(name, blob);
        } else if (selectedType.value === 'Image') {
            await imageService.saveNewImage(name, blob);
        } else if (selectedType.value === 'Movie') {
            await movieService.saveNewMovie(name, blob);
        }
        await fetchAssets();
        showUploadDialog.value = false;
    } catch (e) {
        alert('追加失敗: ' + (e instanceof Error ? e.message : e));
    }
}


// 2. 編集
async function onEdit(asset: Asset) {
    const newName = window.prompt(`${selectedType.value}アセット名を編集`, asset.name);
    if (!newName || newName === asset.name) return;
    try {
        let entity: any = null;
        if (selectedType.value === 'Audio') {
            entity = await audioService.getAudioById(asset.id);
            if (!entity) throw new Error('エンティティ取得失敗');
            entity.rename(newName);
            await audioService.saveNewAudio(newName, entity.audioData);
        } else if (selectedType.value === 'Image') {
            entity = await imageService.getImageById(asset.id);
            if (!entity) throw new Error('エンティティ取得失敗');
            entity.rename(newName);
            await imageService.saveNewImage(newName, entity.imageData);
        } else if (selectedType.value === 'Movie') {
            entity = await movieService.getMovieById(asset.id);
            if (!entity) throw new Error('エンティティ取得失敗');
            entity.rename(newName);
            await movieService.saveNewMovie(newName, entity.movieData);
        }
        await fetchAssets();
    } catch (e) {
        alert('更新失敗: ' + (e instanceof Error ? e.message : e));
    }
}


// 3. 削除
async function onDelete(asset: Asset) {
    if (!window.confirm(`${asset.name} を削除しますか？`)) return;
    try {
        if (selectedType.value === 'Audio') await audioService.deleteAudio(asset.id);
        if (selectedType.value === 'Image') await imageService.deleteImage(asset.id);
        if (selectedType.value === 'Movie') await movieService.deleteMovie(asset.id);
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
