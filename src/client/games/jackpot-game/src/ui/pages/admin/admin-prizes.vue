<template>
  <div class="admin-section">
    <h2>景品設定</h2>
    <div class="admin-actions">
      <button type="button" class="admin-btn icon-only add-icon" @click.prevent="openAddModal" title="Add prizes">
        <span class="emoji">➕</span>
      </button>
      <button class="admin-btn icon-only sync-icon" @click="syncPrizes" :disabled="syncing" :title="'Sync with Server'">
        <span class="emoji">🔄</span>
      </button>
      <button class="admin-btn icon-only delete-icon" @click="openDeleteModal"
        :disabled="!selectedPrizes.length || deleting" title="Delete selected">
        <span class="emoji">🗑️</span>
      </button>
    </div>
    <div v-if="prizes.length" class="list-controls">
      <label class="select-all-label">
        <input type="checkbox" v-model="isAllSelected" class="select-all-checkbox" />
        <span class="sr-only">全選択</span>
      </label>
    </div>

    <ul v-if="prizes.length" class="admin-list">
      <li v-for="prize in prizes" :key="prize.id" class="admin-list-item">
        <input type="checkbox" v-model="selectedPrizes" :value="prize.id" />
        <div class="prize-preview">
          <img v-if="prize.imageDataUrl || prize.imageAssetId" :src="prize.imageDataUrl || prize.imageAssetId"
            alt="image" class="preview-img" @error="onImageError" />
          <span v-else>{{ prize.name }}</span>
        </div>
        <div class="prize-info">
          <span>{{ prize.name }} (確率: {{ prize.probability }}/10)</span>
        </div>
        <button class="admin-btn ml-2" @click="editPrize(prize)">詳細</button>
        <button class="admin-btn ml-2 delete-btn" @click="deletePrize(prize.id)">削除</button>
      </li>
    </ul>
    <div v-else class="empty-state">
      景品はありません
    </div>
  </div>

  <!-- 詳細モーダル -->
  <div v-if="editPrizeData" class="modal-overlay" @click="editPrizeData = null">
    <div class="modal-content add-modal-grid" @click.stop>
      <div class="add-form-column">
        <h3>景品詳細</h3>
        <p>景品の情報を編集してください。</p>

        <div class="field-block">
          <label class="field-label">名前</label>
          <input v-model="editName" type="text" placeholder="景品名" class="admin-input prize-name-input" />
        </div>

        <div class="field-block">
          <label class="field-label">確率</label>
          <input v-model.number="editProbability" type="number" placeholder="確率 (1-10)" min="1" max="10"
            class="admin-input" />
        </div>

        <div class="field-block">
          <label class="field-label">順位</label>
          <input v-model.number="editRank" type="number" placeholder="順位" min="1" class="admin-input" />
        </div>

        <div class="field-block">
          <label class="field-label">画像</label>
          <div class="image-mode">
            <label><input type="radio" v-model="editImageMode" value="upload" /> アップロード</label>
            <label><input type="radio" v-model="editImageMode" value="select" /> 既存から選択</label>
          </div>

          <div style="margin-top:10px">
            <input v-if="editImageMode === 'upload'" type="file" @change="onEditImageChange" accept="image/*"
              class="admin-input" />
            <div v-if="editImageMode === 'upload' && editImageFilename" class="file-name">{{ editImageFilename }}
            </div>

            <select v-if="editImageMode === 'select'" v-model="editImageAssetId" class="admin-input"
              style="margin-top:8px">
              <option value="">選択なし</option>
              <option v-for="asset in imageAssets" :key="asset.id" :value="asset.id">{{ asset.name }}</option>
            </select>
          </div>
        </div>

        <div class="field-block">
          <label class="field-label">BGM1</label>
          <div class="bgm-mode">
            <label><input type="radio" v-model="editBgm1Mode" value="upload" /> アップロード</label>
            <label><input type="radio" v-model="editBgm1Mode" value="select" /> 既存から選択</label>
          </div>

          <div style="margin-top:10px">
            <input v-if="editBgm1Mode === 'upload'" type="file" @change="onEditBgm1Change" accept="audio/*"
              class="admin-input" />
            <div v-if="editBgm1Mode === 'upload' && editBgm1Filename" class="file-name">{{ editBgm1Filename }}
            </div>

            <select v-if="editBgm1Mode === 'select'" v-model="editBgm1AssetId" class="admin-input"
              style="margin-top:8px">
              <option value="">選択なし</option>
              <option v-for="asset in audioAssets" :key="asset.id" :value="asset.id">{{ asset.name }}</option>
            </select>
          </div>
        </div>

        <div class="field-block">
          <label class="field-label">BGM2</label>
          <div class="bgm-mode">
            <label><input type="radio" v-model="editBgm2Mode" value="upload" /> アップロード</label>
            <label><input type="radio" v-model="editBgm2Mode" value="select" /> 既存から選択</label>
          </div>

          <div style="margin-top:10px">
            <input v-if="editBgm2Mode === 'upload'" type="file" @change="onEditBgm2Change" accept="audio/*"
              class="admin-input" />
            <div v-if="editBgm2Mode === 'upload' && editBgm2Filename" class="file-name">{{ editBgm2Filename }}
            </div>

            <select v-if="editBgm2Mode === 'select'" v-model="editBgm2AssetId" class="admin-input"
              style="margin-top:8px">
              <option value="">選択なし</option>
              <option v-for="asset in audioAssets" :key="asset.id" :value="asset.id">{{ asset.name }}</option>
            </select>
          </div>
        </div>

      </div>

      <div class="add-side-column">
        <div class="preview-box">
          <template v-if="editImagePreview">
            <img :src="editImagePreview" alt="preview" class="preview-img" />
          </template>
          <template v-else>
            <div class="preview-placeholder">プレビュー</div>
          </template>
        </div>
      </div>

      <div class="modal-footer">
        <div class="admin-modal-buttons">
          <button class="admin-btn" @click="saveEdit">保存</button>
          <button class="admin-btn cancel-primary" @click="editPrizeData = null">キャンセル</button>
        </div>
      </div>
    </div>
  </div>

  <!-- 追加モーダル -->
  <div v-if="showAddModal" class="modal-overlay">
    <div class="modal-content add-modal-grid">
      <div class="add-form-column">
        <h3>景品を追加</h3>
        <p>追加する景品の情報を入力してください。</p>
        <div class="field-block">
          <label class="field-label">名前</label>
          <input v-model="newPrizeName" type="text" placeholder="景品名" class="admin-input prize-name-input" />
        </div>

        <div class="field-block">
          <label class="field-label">確率</label>
          <input v-model.number="newPrizeProbability" type="number" placeholder="確率 (1-10)" min="1" max="10"
            class="admin-input" />
        </div>

        <div class="field-block">
          <label class="field-label">順位</label>
          <input v-model.number="newPrizeRank" type="number" placeholder="順位" min="1" class="admin-input" />
        </div>

        <div class="field-block">
          <label class="field-label">画像</label>
          <div class="image-mode">
            <label><input type="radio" v-model="newImageMode" value="upload" /> アップロード</label>
            <label><input type="radio" v-model="newImageMode" value="select" /> 既存から選択</label>
          </div>
          <div style="margin-top:10px">
            <input v-if="newImageMode === 'upload'" type="file" @change="onNewImageChange" accept="image/*"
              class="admin-input" />
            <div v-if="newImageMode === 'upload' && newImageFilename" class="file-name">{{ newImageFilename }}
            </div>

            <select v-if="newImageMode === 'select'" v-model="newImageAssetId" class="admin-input"
              style="margin-top:8px">
              <option value="">選択なし</option>
              <option v-for="asset in imageAssets" :key="asset.id" :value="asset.id">{{ asset.name }}</option>
            </select>
          </div>
        </div>

        <div class="field-block">
          <label class="field-label">BGM1</label>
          <div class="bgm-mode">
            <label><input type="radio" v-model="newBgm1Mode" value="upload" /> アップロード</label>
            <label><input type="radio" v-model="newBgm1Mode" value="select" /> 既存から選択</label>
          </div>

          <div style="margin-top:10px">
            <input v-if="newBgm1Mode === 'upload'" type="file" @change="onNewBgm1Change" accept="audio/*"
              class="admin-input" />
            <div v-if="newBgm1Mode === 'upload' && newBgm1Filename" class="file-name">{{ newBgm1Filename }}
            </div>

            <select v-if="newBgm1Mode === 'select'" v-model="newBgm1AssetId" class="admin-input" style="margin-top:8px">
              <option value="">選択なし</option>
              <option v-for="asset in audioAssets" :key="asset.id" :value="asset.id">{{ asset.name }}</option>
            </select>
          </div>
        </div>

        <div class="field-block">
          <label class="field-label">BGM2</label>
          <div class="bgm-mode">
            <label><input type="radio" v-model="newBgm2Mode" value="upload" /> アップロード</label>
            <label><input type="radio" v-model="newBgm2Mode" value="select" /> 既存から選択</label>
          </div>

          <div style="margin-top:10px">
            <input v-if="newBgm2Mode === 'upload'" type="file" @change="onNewBgm2Change" accept="audio/*"
              class="admin-input" />
            <div v-if="newBgm2Mode === 'upload' && newBgm2Filename" class="file-name">{{ newBgm2Filename }}
            </div>

            <select v-if="newBgm2Mode === 'select'" v-model="newBgm2AssetId" class="admin-input" style="margin-top:8px">
              <option value="">選択なし</option>
              <option v-for="asset in audioAssets" :key="asset.id" :value="asset.id">{{ asset.name }}</option>
            </select>
          </div>
        </div>
      </div>

      <div class="add-side-column">
        <div class="preview-box">
          <template v-if="newImagePreview">
            <img :src="newImagePreview" alt="preview" class="preview-img" />
          </template>
          <template v-else>
            <div class="preview-placeholder">プレビュー</div>
          </template>
        </div>
      </div>

      <div class="modal-footer">
        <div class="admin-modal-buttons">
          <button class="admin-btn" @click="confirmAdd"
            :disabled="!newPrizeName.trim() || !newPrizeProbability || adding">追加</button>
          <button class="admin-btn cancel-primary" @click="closeAddModal" :disabled="adding">キャンセル</button>
        </div>
      </div>
    </div>
  </div>

  <!-- 削除確認モーダル -->
  <div v-if="showDeleteModal" class="modal-overlay">
    <div class="modal-content">
      <h3>景品を削除</h3>
      <p>選択した景品を削除しますか？</p>
      <div class="modal-actions">
        <button class="admin-btn delete-btn" @click="confirmDeleteSelected">削除</button>
        <button class="admin-btn" @click="closeDeleteModal">キャンセル</button>
      </div>
    </div>
  </div>

  <!-- 削除中モーダル -->
  <!-- 削除中モーダル -->
  <div v-if="deleting" class="modal-overlay">
    <div class="modal-content">
      <h3>削除中...</h3>
      <p>{{ deleteMessage }}</p>
      <div class="spinner"></div>
    </div>
  </div>

  <!-- 同期中モーダル -->
  <div v-if="syncing" class="modal-overlay">
    <div class="modal-content">
      <h3>サーバーと同期中...</h3>
      <p>{{ syncMessage || "景品を同期しています。しばらくお待ちください。" }}</p>
      <div class="spinner"></div>
    </div>
  </div>
</template>
<script setup lang="ts">
import { ref, onMounted, computed } from 'vue';
import type { Asset } from "../../../model/domains/asset/asset";
import { AssetDto } from "../../../../src/model/applications/asset/dto/asset-dto";
import { AssetService } from '../../../model/applications/asset/asset-service';
import { PrizeService } from '../../../model/applications/prize/prize-service';
import { PrizeAddService } from '../../../model/applications/prize/prize-add-service';
import { PrizeDeleteService } from '../../../model/applications/prize/prize-delete-service';
import type { IPrizeRepository } from '../../../model/domains/prize/repository/i-prize-repository';

import { container } from 'tsyringe';
const prizeRepo = container.resolve<IPrizeRepository>("IPrizeRepository");
const assetService = container.resolve(AssetService);
const prizeService = container.resolve(PrizeService);
const prizeAddService = container.resolve(PrizeAddService);
const prizeDeleteService = container.resolve(PrizeDeleteService);
const prizes = ref<any[]>([]);
const selectedPrizes = ref<string[]>([]);
const assets = ref<any[]>([]);
const imageAssets = computed(() => assets.value.filter(asset => asset.type === 'image'));
const audioAssets = computed(() => assets.value.filter(asset => asset.type === 'audio'));
const onImageError = (event: Event) => {
  const img = event.target as HTMLImageElement;
  img.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTAwIiBoZWlnaHQ9IjEwMCIgdmlld0JveD0iMCAwIDEwMCAxMDAiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CjxyZWN0IHdpZHRoPSIxMDAiIGhlaWdodD0iMTAwIiBmaWxsPSIjNTU1Ii8+Cjx0ZXh0IHg9IjUwIiB5PSI1MCIgZm9udC1mYW1pbHk9IkFyaWFsLCBzYW5zLXNlcmlmIiBmb250LXNpemU9IjEyIiBmaWxsPSIjY2NjIiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBkeT0iMC4zZW0iPk5vIEltYWdlPC90ZXh0Pgo8L3N2Zz4=';
  img.alt = 'No Image';
};

const isAllSelected = computed({
  get: () => {
    return prizes.value.length > 0 && selectedPrizes.value.length === prizes.value.length;
  },
  set: (val: boolean) => {
    if (val) {
      selectedPrizes.value = prizes.value.map(p => p.id);
    } else {
      selectedPrizes.value = [];
    }
  }
});

// add modal state and actions
const showAddModal = ref(false);
const openAddModal = () => { showAddModal.value = true; };
const closeAddModal = () => { showAddModal.value = false; newPrizeName.value = ''; newPrizeProbability.value = 5; newPrizeRank.value = undefined; newImageAsset.value = undefined; newImageAssetId.value = ''; newImageFilename.value = ''; newImagePreview.value = ''; newBgm1AssetId.value = ''; newBgm2AssetId.value = ''; newBgm1Mode.value = 'select'; newBgm2Mode.value = 'select'; newBgm1Filename.value = ''; newBgm2Filename.value = ''; tempBgm1Asset.value = null; tempBgm2Asset.value = null; };
const confirmAdd = async () => { await addPrize(); closeAddModal(); };

// delete modal state
const showDeleteModal = ref(false);
const openDeleteModal = () => { showDeleteModal.value = true; };
const closeDeleteModal = () => { showDeleteModal.value = false; };
const confirmDeleteSelected = async () => { await deleteSelectedPrizes(); closeDeleteModal(); };

// status
const adding = ref(false);
const deleting = ref(false);
const deleteMessage = ref("");
const syncing = ref(false);
const syncMessage = ref("");

const newPrizeName = ref('');
const newPrizeProbability = ref(5);
const newPrizeRank = ref<number | undefined>();
const newImageMode = ref('upload');
const newImageAssetId = ref('');
const newImageAsset = ref<AssetDto | undefined>();
const newImageFilename = ref('');
const newImagePreview = ref('');
const newBgm1AssetId = ref('');
const newBgm2AssetId = ref('');
const newBgm1Mode = ref('select');
const newBgm2Mode = ref('select');
const newBgm1Filename = ref('');
const newBgm2Filename = ref('');

const tempAsset = ref<Asset | null>(null);
const tempBgm1Asset = ref<Asset | null>(null);
const tempBgm2Asset = ref<Asset | null>(null);

const onNewImageChange = async (e: Event) => {
  const file = (e.target as HTMLInputElement).files?.[0];
  if (file) {
    tempAsset.value = await prizeAddService.createTempAsset(file);
    newImageFilename.value = file.name;
    newImagePreview.value = tempAsset.value.dataUrl;
  }
};

const onNewBgm1Change = async (e: Event) => {
  const file = (e.target as HTMLInputElement).files?.[0];
  if (file) {
    tempBgm1Asset.value = await prizeAddService.createTempAsset(file);
    newBgm1Filename.value = file.name;
  }
};

const onNewBgm2Change = async (e: Event) => {
  const file = (e.target as HTMLInputElement).files?.[0];
  if (file) {
    tempBgm2Asset.value = await prizeAddService.createTempAsset(file);
    newBgm2Filename.value = file.name;
  }
};

const addPrize = async () => {
  if (!newPrizeName.value.trim() || !newPrizeProbability.value) return;
  adding.value = true;
  const newPrize: any = {
    id: String(Date.now()),
    name: newPrizeName.value,
    probability: newPrizeProbability.value,
    rank: newPrizeRank.value,
    order: prizes.value.length + 1
  };
  if (newImageMode.value === 'select' && newImageAssetId.value) {
    newPrize.imageAssetId = newImageAssetId.value;
  }
  if (newBgm1Mode.value === 'select' && newBgm1AssetId.value) {
    newPrize.bgm1AssetId = newBgm1AssetId.value;
  }
  if (newBgm2Mode.value === 'select' && newBgm2AssetId.value) {
    newPrize.bgm2AssetId = newBgm2AssetId.value;
  }
  try {
    const addedPrize = await prizeAddService.savePrize(newPrize, tempAsset.value || undefined, tempBgm1Asset.value || undefined, tempBgm2Asset.value || undefined);
    prizes.value.push(addedPrize);
    tempAsset.value = null;
    tempBgm1Asset.value = null;
    tempBgm2Asset.value = null;
    newImagePreview.value = '';
    newImageFilename.value = '';
    newBgm1Filename.value = '';
    newBgm2Filename.value = '';
  } catch (error) {
    console.error("Failed to add prize:", error);
  } finally {
    adding.value = false;
  }
};

const deletePrize = async (id: string) => {
  deleting.value = true;
  deleteMessage.value = "景品を削除しています...";
  try {
    await prizeDeleteService.deletePrize(id);
    await fetchPrizes();
  } catch (error) {
    console.error("Failed to delete prize:", error);
  } finally {
    deleting.value = false;
  }
};

const deleteSelectedPrizes = async () => {
  if (!selectedPrizes.value.length) return;
  deleting.value = true;
  deleteMessage.value = "景品を削除しています...";
  try {
    await prizeDeleteService.deletePrizes(selectedPrizes.value);
    await fetchPrizes();
    selectedPrizes.value = [];
  } catch (error) {
    console.error("Failed to delete prizes:", error);
  } finally {
    deleting.value = false;
  }
};

const syncPrizes = async () => {
  syncing.value = true;
  syncMessage.value = "";
  try {
    await prizeService.syncPrizes();
    await fetchPrizes();
  } catch (error) {
    console.error('同期エラー:', error);
  } finally {
    syncing.value = false;
    syncMessage.value = "";
  }
};

const fetchPrizes = async () => {
  try {
    const fetchedPrizes = await prizeRepo.getPrizes();
    for (const prize of fetchedPrizes) {
      if (prize.imageAssetId) {
        const asset = await assetService.getAssetById(prize.imageAssetId);
        prize.imageDataUrl = asset?.dataUrl;
      }
    }
    prizes.value = fetchedPrizes;
  } catch (error) {
    console.error("Failed to fetch prizes:", error);
    prizes.value = [];
  }
};

const fetchAssets = async () => {
  try {
    assets.value = await assetService.getAllAssets();
  } catch (error) {
    console.error("Failed to fetch assets:", error);
    assets.value = [];
  }
};

const editPrizeData = ref<any>(null);
const editName = ref('');
const editProbability = ref(5);
const editRank = ref<number | undefined>();
const editImageAssetId = ref('');
const editImagePreview = ref('');
const editImageMode = ref('upload');
const editImageFilename = ref('');
const editBgm1AssetId = ref('');
const editBgm2AssetId = ref('');
const editBgm1Mode = ref('select');
const editBgm2Mode = ref('select');
const editBgm1Filename = ref('');
const editBgm2Filename = ref('');

const editTempAsset = ref<Asset | null>(null);
const editTempBgm1Asset = ref<Asset | null>(null);
const editTempBgm2Asset = ref<Asset | null>(null);

const onEditImageChange = async (e: Event) => {
  const file = (e.target as HTMLInputElement).files?.[0];
  if (file) {
    editTempAsset.value = await prizeAddService.createTempAsset(file);
    editImageFilename.value = file.name;
    editImagePreview.value = editTempAsset.value.dataUrl;
  }
};

const onEditBgm1Change = async (e: Event) => {
  const file = (e.target as HTMLInputElement).files?.[0];
  if (file) {
    editTempBgm1Asset.value = await prizeAddService.createTempAsset(file);
    editBgm1Filename.value = file.name;
  }
};

const onEditBgm2Change = async (e: Event) => {
  const file = (e.target as HTMLInputElement).files?.[0];
  if (file) {
    editTempBgm2Asset.value = await prizeAddService.createTempAsset(file);
    editBgm2Filename.value = file.name;
  }
};

const editPrize = (prize: any) => {
  editPrizeData.value = prize;
  editName.value = prize.name;
  editProbability.value = prize.probability;
  editRank.value = prize.rank;
  if (prize.imageAssetId) {
    editImageMode.value = 'select';
    editImageAssetId.value = prize.imageAssetId;
    editImagePreview.value = prize.imageDataUrl || prize.imageAssetId;
  } else {
    editImageMode.value = 'upload';
  }
  editImageFilename.value = '';
  editTempAsset.value = null;
  if (prize.bgm1AssetId) {
    editBgm1Mode.value = 'select';
    editBgm1AssetId.value = prize.bgm1AssetId;
  } else {
    editBgm1Mode.value = 'upload';
  }
  if (prize.bgm2AssetId) {
    editBgm2Mode.value = 'select';
    editBgm2AssetId.value = prize.bgm2AssetId;
  } else {
    editBgm2Mode.value = 'upload';
  }
  editBgm1Filename.value = '';
  editBgm2Filename.value = '';
  editTempBgm1Asset.value = null;
  editTempBgm2Asset.value = null;
};

const saveEdit = async () => {
  if (!editPrizeData.value) return;
  let assetId: string | undefined;
  if (editTempAsset.value) {
    const assetDto = new AssetDto(editTempAsset.value);
    await assetService.addAssets([assetDto]);
    assetId = assetDto.id;
  }
  let bgm1AssetId: string | undefined;
  if (editTempBgm1Asset.value) {
    const assetDto = new AssetDto(editTempBgm1Asset.value);
    await assetService.addAssets([assetDto]);
    bgm1AssetId = assetDto.id;
  }
  let bgm2AssetId: string | undefined;
  if (editTempBgm2Asset.value) {
    const assetDto = new AssetDto(editTempBgm2Asset.value);
    await assetService.addAssets([assetDto]);
    bgm2AssetId = assetDto.id;
  }
  const updatedPrize = {
    ...editPrizeData.value,
    name: editName.value,
    probability: editProbability.value,
    rank: editRank.value,
    imageAssetId: assetId || editImageAssetId.value,
    bgm1AssetId: bgm1AssetId || editBgm1AssetId.value,
    bgm2AssetId: bgm2AssetId || editBgm2AssetId.value,
  };
  try {
    await prizeRepo.updatePrizes([{ id: updatedPrize.id, updateFn: () => updatedPrize }]);
    await fetchPrizes();
    editPrizeData.value = null;
    editName.value = '';
    editProbability.value = 5;
    editRank.value = undefined;
    editImageAssetId.value = '';
    editImagePreview.value = '';
    editImageFilename.value = '';
    editTempAsset.value = null;
    editBgm1AssetId.value = '';
    editBgm2AssetId.value = '';
    editBgm1Mode.value = 'select';
    editBgm2Mode.value = 'select';
    editBgm1Filename.value = '';
    editBgm2Filename.value = '';
    editTempBgm1Asset.value = null;
    editTempBgm2Asset.value = null;
  } catch (error) {
    console.error("Failed to update prize:", error);
  }
};

onMounted(async () => {
  await syncPrizes();
  await fetchPrizes();
  await fetchAssets();
});
</script>

<style scoped>
.admin-section {
  margin-bottom: 28px;
}

.admin-actions {
  margin-bottom: 18px;
  display: flex;
  gap: 12px;
  align-items: center;
  flex-wrap: wrap;
}

.list-controls {
  display: flex;
  align-items: center;
  margin-bottom: 10px;
}

.select-all-checkbox {
  width: 20px;
  height: 20px;
  margin: 0;
  vertical-align: middle;
}

.select-all-label {
  margin-left: 10px;
}

.admin-list {
  list-style: none;
  padding: 0;
  margin: 0;
}

.admin-list-item {
  background: #232b36;
  color: #fff;
  padding: 14px;
  border-radius: 10px;
  margin-bottom: 12px;
  box-shadow: 0 1px 6px rgba(0, 0, 0, 0.12);
  display: grid;
  grid-template-columns: 36px 110px 1fr auto auto;
  gap: 14px;
  align-items: center;
}

.admin-list-item input[type="checkbox"] {
  width: 20px;
  height: 20px;
  justify-self: center;
}

.prize-preview {
  width: 110px;
  height: 96px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #2a3137;
  border-radius: 6px;
  overflow: hidden;
}

.preview-img {
  max-width: 100%;
  max-height: 100%;
  display: block;
}

.prize-info {
  min-width: 0;
}

.ml-2 {
  margin-left: 8px;
}

.empty-state {
  text-align: center;
  color: #c9d7e6;
  font-size: 1.1rem;
  padding: 40px;
}

.admin-input {
  padding: 10px 14px;
  border-radius: 8px;
  border: none;
  background: #232b36;
  color: #fff;
  font-size: 0.98rem;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.08);
}

.admin-input:focus {
  outline: 2px solid #4f8cff;
}

.admin-btn {
  padding: 9px 18px;
  border-radius: 10px;
  border: none;
  background: linear-gradient(90deg, #4f8cff 0%, #aee1ff 100%);
  color: #232b36;
  font-weight: 700;
  cursor: pointer;
  transition: box-shadow 0.18s, background 0.18s, transform 0.12s;
  display: inline-flex;
  align-items: center;
  gap: 8px;
}

.admin-btn:hover {
  box-shadow: 0 6px 18px rgba(79, 140, 255, 0.16);
}

.admin-btn:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}

.delete-btn {
  background: linear-gradient(90deg, #ff6b6b 0%, #ffb3b3 100%);
}

.delete-btn:hover {
  box-shadow: 0 6px 18px rgba(255, 107, 107, 0.14);
}

.icon-only {
  padding: 8px;
  border-radius: 8px;
  background: transparent;
  color: #cfe8ff;
  border: 1px solid rgba(255, 255, 255, 0.04);
}

.icon-only:hover {
  background: rgba(255, 255, 255, 0.02);
}

.add-icon {
  padding: 10px;
  border-radius: 12px;
  background: linear-gradient(180deg, #b6d8ff 0%, #8aaeff 100%);
  color: #232b36;
  border: none;
  box-shadow: 0 6px 18px rgba(79, 140, 255, 0.12);
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.add-icon:hover {
  transform: translateY(-2px);
}

.sync-icon {
  /* visually distinct but subtle */
  border-radius: 8px;
  background: linear-gradient(180deg, rgba(255, 255, 255, 0.02), rgba(255, 255, 255, 0.01));
  color: #dbeeff;
}

.sync-icon .emoji {
  font-weight: 700;
}

.icon-only .emoji,
.add-icon .emoji {
  font-size: 20px;
  line-height: 1;
}

.sr-only {
  position: absolute !important;
  height: 1px;
  width: 1px;
  overflow: hidden;
  clip: rect(1px, 1px, 1px, 1px);
  white-space: nowrap;
  border: 0;
  padding: 0;
  margin: -1px;
}

.image-mode {
  display: flex;
  gap: 16px;
}

.image-mode label {
  display: flex;
  align-items: center;
  gap: 8px;
  color: #fff;
}

.bgm-mode {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.bgm-mode label {
  color: #fff;
  font-weight: 700;
}

.prize-input-group {
  display: flex;
  gap: 12px;
  align-items: center;
  flex-wrap: wrap;
}

.prize-name-input {
  flex: 1;
  min-width: 200px;
}

.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.modal-content {
  background: #232b36;
  color: #fff;
  padding: 28px;
  border-radius: 10px;
  text-align: left;
  box-shadow: 0 6px 28px rgba(0, 0, 0, 0.36);
  max-width: 620px;
  width: 90%;
}

.add-modal-grid {
  display: grid;
  grid-template-columns: 1fr 260px;
  gap: 12px;
  align-items: start;
  margin-top: 12px;
}

.add-form-column .field-label {
  display: block;
  margin-bottom: 8px;
  color: #cfe8ff;
  font-weight: 600;
}

.field-block {
  margin-top: 12px;
}

.add-side-column {
  display: flex;
  flex-direction: column;
  gap: 16px;
  align-items: center;
}

.preview-box {
  width: 240px;
  height: 240px;
  background: #2a3137;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
}

.preview-box .preview-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.preview-placeholder {
  color: #9fb8db
}

.file-name {
  margin-top: 8px;
  color: #cfe8ff;
  font-size: 0.92rem;
}

.modal-footer {
  grid-column: 1 / -1;
  display: flex;
  justify-content: flex-end;
  margin-top: 18px;
}

.admin-modal-buttons {
  display: flex;
  gap: 12px;
  align-items: center;
  justify-content: flex-end;
  margin-top: 18px;
}

.cancel-primary {
  background: #3b4650;
  color: #fff;
}

.modal-actions {
  margin-top: 16px;
  display: flex;
  gap: 12px;
  justify-content: flex-end;
}

.admin-modal-buttons {
  display: flex;
  gap: 12px;
  align-items: center;
  justify-content: flex-end;
  margin-top: 18px;
}

.spinner {
  margin: 16px auto;
  width: 40px;
  height: 40px;
  border: 4px solid #f3f3f3;
  border-top: 4px solid #4f8cff;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  0% {
    transform: rotate(0deg);
  }

  100% {
    transform: rotate(360deg);
  }
}
</style>
