<template>
  <div>
    <h2>アセット編集画面</h2>
    <AssetTypeTabs :type="selectedType" @update:type="selectedType = $event" />
    <p>選択中: {{ selectedType }} アセット</p>
    <AssetList
      :type="selectedType"
      :assets="currentAssets"
      @add="showUploadDialog = true"
      @edit="onEdit"
      @delete="onDelete"
    />
    <AssetUploadDialog
      :visible="showUploadDialog"
      :type="selectedType"
      @submit="onUploadSubmit"
      @close="showUploadDialog = false"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useLocalStorage } from '../../../packages/shared-composables/src/use-localstorage';
import { GasFunctionService } from '../../../packages/common-lib/src/google-apps-script/gas-script-service';

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

// サーバーAPI名（仮）
const API_NAME = 'callOctopusSchedulerApi';
const ADD_FUNC = 'AssetService.addAsset';
const DELETE_FUNC = 'AssetService.deleteAsset';
const UPDATE_FUNC = 'AssetService.updateAsset';
const LIST_FUNC = 'AssetService.listAssets';

// サーバーからアセット一覧を取得しlocalStorageにキャッシュ
async function fetchAssets() {
  const gasService = GasFunctionService.create(API_NAME);
  if (!gasService) return;
  const func = gasService.createCall<any>(LIST_FUNC, { type: selectedType.value })
    .withTimeout(20000)
    .withSuccessed((result) => {
      // サーバー返却値をlocalStorageに保存
      for (const type of ['Audio', 'Image', 'Movie'] as AssetType[]) {
        const arr = result[type] || [];
        assets.value[type] = arr;
        arr.forEach(async (a: Asset) => await save(a.id, a));
      }
    })
    .withFailuered((msg) => alert('サーバー取得失敗: ' + msg));
  await gasService.all(func);
}

onMounted(() => {
  fetchAssets();
});

const currentAssets = computed(() => assets.value[selectedType.value]);

// 1. 追加
async function onUploadSubmit({ name, file }: { name: string; file: File }) {
  const id = `${selectedType.value.toLowerCase()}_${Date.now()}`;
  const data = await file.arrayBuffer();
  const newAsset: Asset = { id, name, data: new Blob([data], { type: file.type }) };
  // サーバーAPI呼び出し
  const gasService = GasFunctionService.create(API_NAME);
  if (!gasService) return;
  const func = gasService.createCall<any>(ADD_FUNC, { type: selectedType.value, name, data: Array.from(new Uint8Array(data)), mime: file.type })
    .withTimeout(20000)
    .withSuccessed(() => {
      save(id, newAsset);
      assets.value[selectedType.value].push(newAsset);
      showUploadDialog.value = false;
    })
    .withFailuered((msg) => alert('サーバー追加失敗: ' + msg));
  await gasService.all(func);
}

// 2. 編集
async function onEdit(asset: Asset) {
  const newName = window.prompt(`${selectedType.value}アセット名を編集`, asset.name);
  if (!newName || newName === asset.name) return;
  const updated: Asset = { ...asset, name: newName };
  const gasService = GasFunctionService.create(API_NAME);
  if (!gasService) return;
  const func = gasService.createCall<any>(UPDATE_FUNC, { id: asset.id, name: newName })
    .withTimeout(20000)
    .withSuccessed(() => {
      save(asset.id, updated);
      const arr = assets.value[selectedType.value];
      const idx = arr.findIndex(a => a.id === asset.id);
      if (idx !== -1) arr[idx] = updated;
    })
    .withFailuered((msg) => alert('サーバー更新失敗: ' + msg));
  await gasService.all(func);
}

// 3. 削除
async function onDelete(asset: Asset) {
  if (!window.confirm(`${asset.name} を削除しますか？`)) return;
  const gasService = GasFunctionService.create(API_NAME);
  if (!gasService) return;
  const func = gasService.createCall<any>(DELETE_FUNC, { id: asset.id })
    .withTimeout(20000)
    .withSuccessed(() => {
      remove(asset.id);
      assets.value[selectedType.value] = assets.value[selectedType.value].filter(a => a.id !== asset.id);
    })
    .withFailuered((msg) => alert('サーバー削除失敗: ' + msg));
  await gasService.all(func);
}
</script>

<style scoped>
/* 必要に応じてスタイル追加 */
</style>
