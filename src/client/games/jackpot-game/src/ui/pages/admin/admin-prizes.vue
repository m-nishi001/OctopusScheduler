<template>
  <div class="admin-section">
    <h2>景品設定</h2>
    <div class="admin-actions">
      <button type="button" class="admin-btn icon-only add-icon" @click.prevent="openAddModal" title="Add prizes">
        <span class="emoji">➕</span>
      </button>
      <button class="admin-btn icon-only sync-icon" @click.prevent="openPrizesSyncModal" title="Sync prizes"
        :disabled="syncing">
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
          <img v-if="prize.imageAssetId" :src="objectUrlMap.get(prize.imageAssetId) || prize.imageAssetId" alt="image"
            class="preview-img" @error="onImageError" />
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


  <div v-if="editPrizeData" class="modal-overlay">
    <div class="modal-content wide-modal" @click.stop>
      <div class="add-modal-grid">
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

          <div class="field-block left-col">
            <label class="field-label">抽選アニメーション</label>
            <select v-model="editAnimation" class="admin-input">
              <option value="roulette">ルーレット</option>
            </select>
          </div>

          <div class="field-block">
            <label class="field-label">画像</label>
            <div class="image-mode">
              <div class="image-radio-group">
                <label><input type="radio" v-model="editImageMode" value="upload" /> アップロード</label>
                <label><input type="radio" v-model="editImageMode" value="select" /> 既存から選択</label>
              </div>
              <div class="image-select-group">
                <select v-if="editImageMode === 'select'" v-model="editImageAssetId" class="admin-input">
                  <option value="">選択なし</option>
                  <option v-for="asset in imageAssets" :key="asset.id" :value="asset.id">{{ asset.name }}</option>
                </select>
                <div v-if="editImageMode === 'upload'" class="image-file-input-wrap">
                  <input type="file" @change="onEditImageChange" accept="image/*" class="admin-input" />
                  <span v-if="editImageFilename" class="file-name" style="margin-left:8px">{{ editImageFilename
                    }}</span>
                </div>
              </div>
            </div>
          </div>

          <div class="field-block span-2">
            <label class="field-label">BGM1</label>
            <div class="bgm-mode">
              <div class="bgm-radio-group">
                <label><input type="radio" v-model="editBgm1Mode" value="upload" /> アップロード</label>
                <label><input type="radio" v-model="editBgm1Mode" value="select" /> 既存から選択</label>
              </div>
              <div class="bgm-select-group">
                <select v-if="editBgm1Mode === 'select'" v-model="editBgm1AssetId" class="admin-input">
                  <option value="">選択なし</option>
                  <option v-for="asset in audioAssets" :key="asset.id" :value="asset.id">{{ asset.name }}</option>
                </select>
                <div v-if="editBgm1Mode === 'upload'" class="bgm-file-input-wrap">
                  <input type="file" @change="onEditBgm1Change" accept="audio/*" class="admin-input" />
                  <span v-if="editBgm1Filename" class="file-name" style="margin-left:8px">{{ editBgm1Filename }}</span>
                </div>
              </div>
            </div>
          </div>

          <div class="field-block span-2">
            <label class="field-label">BGM2</label>
            <div class="bgm-mode">
              <div class="bgm-radio-group">
                <label><input type="radio" v-model="editBgm2Mode" value="upload" /> アップロード</label>
                <label><input type="radio" v-model="editBgm2Mode" value="select" /> 既存から選択</label>
              </div>
              <div class="bgm-select-group">
                <select v-if="editBgm2Mode === 'select'" v-model="editBgm2AssetId" class="admin-input">
                  <option value="">選択なし</option>
                  <option v-for="asset in audioAssets" :key="asset.id" :value="asset.id">{{ asset.name }}</option>
                </select>
                <div v-if="editBgm2Mode === 'upload'" class="bgm-file-input-wrap">
                  <input type="file" @change="onEditBgm2Change" accept="audio/*" class="admin-input" />
                  <span v-if="editBgm2Filename" class="file-name" style="margin-left:8px">{{ editBgm2Filename }}</span>
                </div>
              </div>
            </div>
          </div>

        </div>

        <div class="add-side-column">
          <div class="preview-box preview-box--small">
            <template v-if="editImagePreview">
              <img :src="editImagePreview" alt="preview" class="preview-img" />
            </template>
            <template v-else>
              <div class="preview-placeholder">プレビュー</div>
            </template>
          </div>
        </div>

      </div>

      <div class="modal-footer">
        <div class="footer-left"></div>
        <div class="footer-right admin-modal-buttons">
          <button class="admin-btn" @click="saveEdit">保存</button>
          <button class="admin-btn cancel-primary" @click="editPrizeData = null">キャンセル</button>
        </div>
      </div>
    </div>
  </div>


  <div v-if="showAddModal" class="modal-overlay">
    <div class="modal-content wide-modal">
      <div class="add-modal-grid">
        <div class="add-form-column">
          <h3>景品を追加</h3>
          <p>追加する景品の情報を入力してください。</p>
          <div class="field-block span-2">
            <label class="field-label">名前</label>
            <input v-model="newPrizeName" type="text" placeholder="景品名" class="admin-input prize-name-input" />
          </div>

          <div class="two-col span-2">
            <div class="field-block">
              <label class="field-label">確率</label>
              <input v-model.number="newPrizeProbability" type="number" placeholder="確率 (1-10)" min="1" max="10"
                class="admin-input" />
            </div>
            <div class="field-block">
              <label class="field-label">順位</label>
              <input v-model.number="newPrizeRank" type="number" placeholder="順位" min="1" class="admin-input" />
            </div>
          </div>

          <div class="field-block span-2">
            <label class="field-label">画像</label>
            <div class="image-mode">
              <div class="image-radio-group">
                <label><input type="radio" v-model="newImageMode" value="upload" /> アップロード</label>
                <label><input type="radio" v-model="newImageMode" value="select" /> 既存から選択</label>
              </div>
              <div class="image-select-group">
                <select v-if="newImageMode === 'select'" v-model="newImageAssetId" class="admin-input">
                  <option value="">選択なし</option>
                  <option v-for="asset in imageAssets" :key="asset.id" :value="asset.id">{{ asset.name }}</option>
                </select>
                <div v-if="newImageMode === 'upload'" class="image-file-input-wrap">
                  <input type="file" @change="onNewImageChange" accept="image/*" class="admin-input" />
                  <span v-if="newImageFilename" class="file-name" style="margin-left:8px">{{ newImageFilename }}</span>
                </div>
              </div>
            </div>
          </div>

          <!-- Move animation selection below image so it appears in the left/form column
               rather than overlapping the preview on the right. -->
          <div class="field-block left-col">
            <label class="field-label">抽選アニメーション</label>
            <select v-model="newPrizeAnimation" class="admin-input">
              <option value="roulette">ルーレット</option>
            </select>
          </div>

          <div class="field-block span-2">
            <label class="field-label">BGM1</label>
            <div class="bgm-mode">
              <div class="bgm-radio-group">
                <label><input type="radio" v-model="newBgm1Mode" value="upload" /> アップロード</label>
                <label><input type="radio" v-model="newBgm1Mode" value="select" /> 既存から選択</label>
              </div>
              <div class="bgm-select-group">
                <select v-if="newBgm1Mode === 'select'" v-model="newBgm1AssetId" class="admin-input">
                  <option value="">選択なし</option>
                  <option v-for="asset in audioAssets" :key="asset.id" :value="asset.id">{{ asset.name }}</option>
                </select>
                <div v-if="newBgm1Mode === 'upload'" class="bgm-file-input-wrap">
                  <input type="file" @change="onNewBgm1Change" accept="audio/*" class="admin-input" />
                  <span v-if="newBgm1Filename" class="file-name" style="margin-left:8px">{{ newBgm1Filename }}</span>
                </div>
              </div>
            </div>
          </div>

          <div class="field-block span-2">
            <label class="field-label">BGM2</label>
            <div class="bgm-mode">
              <div class="bgm-radio-group">
                <label><input type="radio" v-model="newBgm2Mode" value="upload" /> アップロード</label>
                <label><input type="radio" v-model="newBgm2Mode" value="select" /> 既存から選択</label>
              </div>
              <div class="bgm-select-group">
                <select v-if="newBgm2Mode === 'select'" v-model="newBgm2AssetId" class="admin-input">
                  <option value="">選択なし</option>
                  <option v-for="asset in audioAssets" :key="asset.id" :value="asset.id">{{ asset.name }}</option>
                </select>
                <div v-if="newBgm2Mode === 'upload'" class="bgm-file-input-wrap">
                  <input type="file" @change="onNewBgm2Change" accept="audio/*" class="admin-input" />
                  <span v-if="newBgm2Filename" class="file-name" style="margin-left:8px">{{ newBgm2Filename }}</span>
                </div>
              </div>
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

      </div>

      <div class="modal-footer">
        <div class="footer-left"></div>
        <div class="footer-right admin-modal-buttons">
          <button class="admin-btn" @click="confirmAdd"
            :disabled="!newPrizeName.trim() || !newPrizeProbability || adding">追加</button>
          <button class="admin-btn cancel-primary" @click="closeAddModal" :disabled="adding">キャンセル</button>
        </div>
      </div>
    </div>
  </div>


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


  <div v-if="deleting" class="modal-overlay">
    <div class="modal-content">
      <h3>削除中...</h3>
      <p>{{ deleteMessage }}</p>
      <div class="spinner"></div>
    </div>
  </div>


  <div v-if="syncing" class="modal-overlay">
    <div class="modal-content">
      <h3>サーバーと同期中...</h3>
      <p>{{ syncMessage || "景品を同期しています。しばらくお待ちください。" }}</p>
      <div class="spinner"></div>
    </div>
  </div>


  <div v-if="showSyncModeModal" class="modal-overlay">
    <div class="modal-content">
      <h3>同期モードを選択</h3>
      <p>同期時にどちらを正としますか？</p>
      <div class="modal-actions">
        <button class="admin-btn" @click.prevent="confirmPrizesSyncMode('local')">ローカル優先 (Local wins)</button>
        <button class="admin-btn sync-btn" @click.prevent="confirmPrizesSyncMode('drive')">Drive優先 (Drive wins)</button>
        <button class="admin-btn delete-btn" @click.prevent="showSyncModeModal = false">キャンセル</button>
      </div>
    </div>
  </div>


  <div v-if="showReplaceWarningModal" class="modal-overlay">
    <div class="modal-content">
      <h3>注意: ローカルデータを置換します</h3>
      <p>Drive のコンテンツに合わせてローカルの景品を置換します。既存のローカルデータは削除されます。続行しますか？</p>
      <div class="modal-actions">
        <button class="admin-btn delete-btn" @click.prevent="showReplaceWarningModal = false">キャンセル</button>
        <button class="admin-btn sync-btn" @click.prevent="performReplaceFromDrive">置換して同期する</button>
      </div>
    </div>
  </div>
</template>
<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount, computed } from 'vue';
import type { Asset } from "../../../model/domains/drive-data/asset-data";
import { AssetDataService } from '../../../model/applications/asset/asset-data-service';
import { PrizeService } from '../../../model/applications/prize/prize-service';
import type { IPrizeRepository } from '../../../model/domains/prize/repository/i-prize-repository';

import { container } from 'tsyringe';
import { IPrizeRepositoryToken } from '../../../model/domains/prize/repository/i-prize-repository';
const prizeRepo = container.resolve<IPrizeRepository>(IPrizeRepositoryToken);
const assetDataService = container.resolve(AssetDataService);
const prizeService = container.resolve(PrizeService);
const prizes = ref<any[]>([]);
const selectedPrizes = ref<string[]>([]);
const assets = ref<any[]>([]);
const objectUrlMap = new Map<string, string>();
const imageAssets = computed(() => assets.value.filter(asset => asset.blob.type.startsWith('image')));
const audioAssets = computed(() => assets.value.filter(asset => asset.blob.type.startsWith('audio')));
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

const showAddModal = ref(false);
const openAddModal = () => { showAddModal.value = true; };
const closeAddModal = () => { showAddModal.value = false; newPrizeName.value = ''; newPrizeProbability.value = 5; newPrizeRank.value = undefined; newImageAsset.value = undefined; newImageAssetId.value = ''; newImageFilename.value = ''; newImagePreview.value = ''; newBgm1AssetId.value = ''; newBgm2AssetId.value = ''; newBgm1Mode.value = 'select'; newBgm2Mode.value = 'select'; newBgm1Filename.value = ''; newBgm2Filename.value = ''; tempBgm1Asset.value = null; tempBgm2Asset.value = null; };
const confirmAdd = async () => { await addPrize(); closeAddModal(); };

const showDeleteModal = ref(false);
const openDeleteModal = () => { showDeleteModal.value = true; };
const closeDeleteModal = () => { showDeleteModal.value = false; };
const confirmDeleteSelected = async () => { await deleteSelectedPrizes(); closeDeleteModal(); };

const adding = ref(false);
const deleting = ref(false);
const deleteMessage = ref("");
const syncing = ref(false);
const syncMessage = ref("");

const newPrizeName = ref('');
const newPrizeProbability = ref(5);
const newPrizeRank = ref<number | undefined>();
const newPrizeAnimation = ref('roulette');
const newImageMode = ref('upload');
const newImageAssetId = ref('');
const newImageAsset = ref<Asset | undefined>();
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

const newImagePreviewUrl = ref<string | null>(null);
const editImagePreviewUrl = ref<string | null>(null);

const onNewImageChange = async (e: Event) => {
  const file = (e.target as HTMLInputElement).files?.[0];
  if (file) {
    const dto = await assetDataService.createDriveDataDtoFromFile(file);
    tempAsset.value = dto;
    newImageFilename.value = file.name;
    if (newImagePreviewUrl.value) {
      try { URL.revokeObjectURL(newImagePreviewUrl.value); } catch { }
      newImagePreviewUrl.value = null;
    }
    newImagePreviewUrl.value = URL.createObjectURL(file);
    newImagePreview.value = newImagePreviewUrl.value;
  }
};

const onNewBgm1Change = async (e: Event) => {
  const file = (e.target as HTMLInputElement).files?.[0];
  if (file) {
    tempBgm1Asset.value = await assetDataService.createDriveDataDtoFromFile(file);
    newBgm1Filename.value = file.name;
  }
};

const onNewBgm2Change = async (e: Event) => {
  const file = (e.target as HTMLInputElement).files?.[0];
  if (file) {
    tempBgm2Asset.value = await assetDataService.createDriveDataDtoFromFile(file);
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
    animation: newPrizeAnimation.value || 'roulette',
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
    if (tempAsset.value) {
      const updated = await assetDataService.addAssetData([tempAsset.value]);
      const updatedAsset = updated[0];
      newPrize.imageAssetId = updatedAsset.id;

      try {

        if (newImagePreviewUrl.value) {
          try { URL.revokeObjectURL(newImagePreviewUrl.value); } catch { }
          newImagePreviewUrl.value = null;
          newImagePreview.value = '';
        }
        const url = URL.createObjectURL(updatedAsset.blob);

        if (objectUrlMap.has(updatedAsset.id)) {
          try { URL.revokeObjectURL(objectUrlMap.get(updatedAsset.id) as string); } catch { }
        }
        objectUrlMap.set(updatedAsset.id, url);
      } catch {
      }
      tempAsset.value = null;
    }
    if (tempBgm1Asset.value) {
      const updated = await assetDataService.addAssetData([tempBgm1Asset.value]);
      newPrize.bgm1AssetId = updated[0].id;
      tempBgm1Asset.value = null;
    }
    if (tempBgm2Asset.value) {
      const updated = await assetDataService.addAssetData([tempBgm2Asset.value]);
      newPrize.bgm2AssetId = updated[0].id;
      tempBgm2Asset.value = null;
    }
    const addedPrize = await prizeService.savePrize(newPrize);
    prizes.value.push(addedPrize);
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
    await prizeService.deletePrize(id);
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
    await prizeService.deletePrizes(selectedPrizes.value);
    await fetchPrizes();
    selectedPrizes.value = [];
  } catch (error) {
    console.error("Failed to delete prizes:", error);
  } finally {
    deleting.value = false;
  }
};

const fetchPrizes = async () => {
  try {
    const fetchedPrizes = await prizeRepo.getPrizes();

    for (const prize of fetchedPrizes) {
      if (prize.imageAssetId) {
        const asset = await assetDataService.getAssetDataById(prize.imageAssetId);
        if (asset && asset.id && !objectUrlMap.has(asset.id)) {
          try { objectUrlMap.set(asset.id, URL.createObjectURL(asset.blob)); } catch { }
        }
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
    assets.value = await assetDataService.getAllAssetData();
  } catch (error) {
    console.error("Failed to fetch assets:", error);
    assets.value = [];
  }
};

const PRIZE_STORAGE_KEY = 'jackpot-game-prizes-json';

const savePrizesToLocalJson = async () => {
  try {
    const payload = JSON.stringify(prizes.value || []);
    localStorage.setItem(PRIZE_STORAGE_KEY, payload);
  } catch (e) {
    console.error('Failed to save prizes JSON to localStorage', e);
  }
};

const uploadPrizesJsonToDrive = async () => {
  try {
    const json = localStorage.getItem(PRIZE_STORAGE_KEY) || JSON.stringify(prizes.value || []);
    const service = new (await import('/root/google_apps_script/octopus-scheduler/src/client/packages/common-lib/src/google-apps-script/gas-script-service')).GasFunctionService('addJson');
    const driveJson = {
      metadata: {
        driveDataId: 'prizes-json-' + Date.now(),
        fileId: '',
        parentFolderId: '',
        lastUpdate: new Date().toISOString(),
        size: json.length,
      },
      fileName: 'prizes.json',
      jsonText: json,
      uploadDate: new Date().toISOString(),
      parentFolderId: '',
    };
    const res = await service.call<any>(driveJson);
    const fileId = res?.fileId || res?.data?.fileId;
    if (fileId) {
      localStorage.setItem('jackpot-prizes-last-file-id', fileId);
      console.log('Uploaded prizes.json fileId=', fileId);
    }
  } catch (e) {
    console.error('Failed to upload prizes JSON via GAS', e);
  }
};

const downloadPrizesJsonFromDrive = async () => {
  try {
    const lastId = localStorage.getItem('jackpot-prizes-last-file-id');
    if (!lastId) {
      console.warn('No last uploaded prizes file id saved');
      return;
    }
    const GasFn = (await import('/root/google_apps_script/octopus-scheduler/src/client/packages/common-lib/src/google-apps-script/gas-script-service')).GasFunctionService;
    const service = new GasFn('getJson');
    const resp = await service.call<{ json: string } | null>(lastId);
    if (resp && resp.json) {
      const json = resp.json;
      localStorage.setItem(PRIZE_STORAGE_KEY, json);
      try {
        const parsed = JSON.parse(json || '[]');
        if (Array.isArray(parsed)) {
          try {
            await prizeRepo.replaceAllPrizes(parsed as any);
          } catch (e) {
            console.error('Failed to persist prizes into local repo:', e);
          }
          await fetchPrizes();
        } else {
          console.warn('Downloaded prizes JSON is not an array');
        }
      } catch (e) {
        console.error('Failed to parse downloaded prizes JSON', e);
      }
    }
  } catch (e) {
    console.error('Failed to download prizes JSON via GAS', e);
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
const editAnimation = ref('roulette');

const editTempAsset = ref<Asset | null>(null);
const editTempBgm1Asset = ref<Asset | null>(null);
const editTempBgm2Asset = ref<Asset | null>(null);

const onEditImageChange = async (e: Event) => {
  const file = (e.target as HTMLInputElement).files?.[0];
  if (file) {
    const dto = await assetDataService.createDriveDataDtoFromFile(file);
    editTempAsset.value = dto;
    editImageFilename.value = file.name;
    if (editImagePreviewUrl.value) {
      try { URL.revokeObjectURL(editImagePreviewUrl.value); } catch { }
      editImagePreviewUrl.value = null;
    }
    editImagePreviewUrl.value = URL.createObjectURL(file);
    editImagePreview.value = editImagePreviewUrl.value;
  }
};

const onEditBgm1Change = async (e: Event) => {
  const file = (e.target as HTMLInputElement).files?.[0];
  if (file) {
    editTempBgm1Asset.value = await assetDataService.createDriveDataDtoFromFile(file);
    editBgm1Filename.value = file.name;
  }
};

const onEditBgm2Change = async (e: Event) => {
  const file = (e.target as HTMLInputElement).files?.[0];
  if (file) {
    editTempBgm2Asset.value = await assetDataService.createDriveDataDtoFromFile(file);
    editBgm2Filename.value = file.name;
  }
};

const editPrize = async (prize: any) => {
  editPrizeData.value = prize;
  editName.value = prize.name;
  editProbability.value = prize.probability;
  editRank.value = prize.rank;
  editAnimation.value = prize.animation || 'roulette';

  if (editImagePreviewUrl.value) {
    try { URL.revokeObjectURL(editImagePreviewUrl.value); } catch { }
    editImagePreviewUrl.value = null;
  }
  if (prize.imageAssetId) {

    editImageMode.value = 'select';
    editImageAssetId.value = prize.imageAssetId;
    editImagePreview.value = objectUrlMap.get(prize.imageAssetId) || prize.imageAssetId;

    try {
      const exists = assets.value.find((a: any) => a.id === prize.imageAssetId);
      if (!exists) {
        const fetched = await assetDataService.getAssetDataById(prize.imageAssetId);
        if (fetched) assets.value.push(fetched);
      }
    } catch (e) {

      console.warn('Failed to fetch image asset for edit select:', e);
    }
  } else if (prize.imageDataUrl) {

    editImageMode.value = 'select';
    editImageAssetId.value = '';
    try {
      const parts = prize.imageDataUrl.split(',');
      const meta = parts[0] || '';
      const isBase64 = meta.indexOf(';base64') !== -1;
      const m = meta.match(/data:([^;]+)/);
      const mime = m ? m[1] : 'application/octet-stream';
      let raw = '';
      if (isBase64) {
        raw = atob(parts[1] || '');
      } else {
        raw = decodeURIComponent(parts[1] || '');
      }
      const u8 = new Uint8Array(raw.length);
      for (let i = 0; i < raw.length; i++) u8[i] = raw.charCodeAt(i);
      const b = new Blob([u8], { type: mime });
      editImagePreviewUrl.value = URL.createObjectURL(b);
      editImagePreview.value = editImagePreviewUrl.value;
    } catch (e) {

      console.warn('failed to convert prize.imageDataUrl to object URL', e);
      editImagePreview.value = prize.imageDataUrl;
    }
  } else {
    editImageMode.value = 'upload';
  }
  editImageFilename.value = '';
  editTempAsset.value = null;
  if (prize.bgm1AssetId) {
    editBgm1Mode.value = 'select';
    editBgm1AssetId.value = prize.bgm1AssetId;

    try {
      const exists1 = assets.value.find((a: any) => a.id === prize.bgm1AssetId);
      if (!exists1) {
        const fetched1 = await assetDataService.getAssetDataById(prize.bgm1AssetId);
        if (fetched1) assets.value.push(fetched1);
      }
    } catch (e) {
      console.warn('Failed to fetch bgm1 asset for edit select:', e);
    }
  } else {
    editBgm1Mode.value = 'upload';
  }
  if (prize.bgm2AssetId) {
    editBgm2Mode.value = 'select';
    editBgm2AssetId.value = prize.bgm2AssetId;

    try {
      const exists2 = assets.value.find((a: any) => a.id === prize.bgm2AssetId);
      if (!exists2) {
        const fetched2 = await assetDataService.getAssetDataById(prize.bgm2AssetId);
        if (fetched2) assets.value.push(fetched2);
      }
    } catch (e) {
      console.warn('Failed to fetch bgm2 asset for edit select:', e);
    }
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
    const updatedAssets = await assetDataService.addAssetData([editTempAsset.value]);
    const updatedAsset = updatedAssets[0];
    editTempAsset.value = updatedAsset;
    assetId = updatedAsset.id;
    try {
      const url = URL.createObjectURL(updatedAsset.blob);
      if (objectUrlMap.has(updatedAsset.id)) {
        try { URL.revokeObjectURL(objectUrlMap.get(updatedAsset.id) as string); } catch { }
      }
      objectUrlMap.set(updatedAsset.id, url);
    } catch { }
  }
  let bgm1AssetId: string | undefined;
  if (editTempBgm1Asset.value) {
    const updatedAssets = await assetDataService.addAssetData([editTempBgm1Asset.value]);
    editTempBgm1Asset.value = updatedAssets[0];
    bgm1AssetId = editTempBgm1Asset.value.id;
  }
  let bgm2AssetId: string | undefined;
  if (editTempBgm2Asset.value) {
    const updatedAssets = await assetDataService.addAssetData([editTempBgm2Asset.value]);
    editTempBgm2Asset.value = updatedAssets[0];
    bgm2AssetId = editTempBgm2Asset.value.id;
  }
  const updatedPrize = {
    ...editPrizeData.value,
    name: editName.value,
    probability: editProbability.value,
    rank: editRank.value,
    animation: editAnimation.value,
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
  await fetchPrizes();
  await fetchAssets();
  // default animation for new prizes
  newPrizeAnimation.value = 'roulette';
});

const showSyncModeModal = ref(false);
const showReplaceWarningModal = ref(false);
const pendingSyncMode = ref<"drive" | "local" | null>(null);

const openPrizesSyncModal = () => {
  showSyncModeModal.value = true;
};

const confirmPrizesSyncMode = async (mode: "drive" | "local") => {
  showSyncModeModal.value = false;
  if (mode === 'drive') {
    pendingSyncMode.value = 'drive';
    showReplaceWarningModal.value = true;
    return;
  }

  syncing.value = true;
  syncMessage.value = "";
  try {
    await assetDataService.syncAssetData((message) => {
      syncMessage.value = message;
    });
    await fetchPrizes();
  } catch (error) {
    console.error('同期エラー:', error);
  } finally {
    syncing.value = false;
    syncMessage.value = "";
  }
};

const performReplaceFromDrive = async () => {
  showReplaceWarningModal.value = false;
  if (pendingSyncMode.value !== 'drive') return;
  pendingSyncMode.value = null;
  syncing.value = true;
  syncMessage.value = "";
  try {

    if (typeof (assetDataService as any).replaceLocalWithDrive === 'function') {
      await (assetDataService as any).replaceLocalWithDrive((message: string) => { syncMessage.value = message; });
    } else {

      await downloadPrizesJsonFromDrive();
    }
    await fetchPrizes();
  } catch (error) {
    console.error('同期エラー:', error);
  } finally {
    syncing.value = false;
    syncMessage.value = "";
  }
};



void savePrizesToLocalJson;
void uploadPrizesJsonToDrive;

onBeforeUnmount(() => {
  if (newImagePreviewUrl.value) {
    try { URL.revokeObjectURL(newImagePreviewUrl.value); } catch { }
  }
  if (editImagePreviewUrl.value) {
    try { URL.revokeObjectURL(editImagePreviewUrl.value); } catch { }
  }

  try {
    objectUrlMap.forEach((url) => {
      try { URL.revokeObjectURL(url); } catch { }
    });
    objectUrlMap.clear();
  } catch { }
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
  padding: 8px 12px;
  border-radius: 8px;
  border: none;
  background: #232b36;
  color: #fff;
  font-size: 0.96rem;
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
  flex-direction: row;
  gap: 12px;
  align-items: center;
}

.bgm-mode label {
  color: #fff;
  font-weight: 700;
}

.bgm-radio-group {
  display: flex;
  gap: 12px;
  align-items: center;
}


.bgm-radio-group label {
  white-space: nowrap;
  display: inline-flex;
  align-items: center;
  gap: 6px;
}


.bgm-mode {
  flex-wrap: nowrap;
}

.bgm-select-group {
  min-width: 220px;
}

.bgm-file-input-wrap {
  display: inline-flex;
  align-items: center;
  gap: 8px;
}

.bgm-file-input-wrap .admin-input[type="file"] {
  padding: 6px 10px;
  min-width: 140px;
}


.image-radio-group {
  display: flex;
  gap: 12px;
  align-items: center;
}

.image-select-group {
  min-width: 220px;
}

/* helper to force a field into the left/main column of the grid */
.left-col {
  grid-column: 1 / 2;
}

.image-file-input-wrap {
  display: inline-flex;
  align-items: center;
  gap: 8px;
}

.image-file-input-wrap .admin-input[type="file"] {
  padding: 6px 10px;
  min-width: 140px;
}

.image-radio-group label {
  white-space: nowrap;
  display: inline-flex;
  align-items: center;
  gap: 6px;
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


.modal-overlay {
  -ms-overflow-style: none;

  scrollbar-width: none;

}

.modal-overlay::-webkit-scrollbar {
  width: 0;
  height: 0;
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


.modal-content.wide-modal {
  width: 70vw;
  max-width: none;
  flex: 0 0 70vw;
  margin: 0 auto;

  /* allow the dialog to grow but never overflow the viewport
     keep internal scrolling inside the grid area */
  max-height: calc(100vh - 80px);
  height: auto;
  display: flex;
  flex-direction: column;
}

.add-modal-grid {
  display: grid;
  /* make the preview column responsive: allow it to grow up to 320px
    but stay at least 200px so the preview remains useful */
  grid-template-columns: 1fr minmax(200px, 320px);
  gap: 14px;
  align-items: start;
  margin-top: 12px;

  flex: 1 1 auto;
  min-height: 0;

  overflow-y: auto;
  overflow-x: hidden;


  scrollbar-gutter: stable both-edges;
  --scrollbar-reserve: 16px;
  padding-right: var(--scrollbar-reserve);
  box-sizing: border-box;
}


.add-modal-grid {

  scrollbar-width: thin;

  -ms-overflow-style: auto;
}


.add-modal-grid,
.add-form-column,
.add-side-column {
  min-width: 0;
}


.modal-content.wide-modal {
  overflow-x: hidden;
}


.add-modal-grid::-webkit-scrollbar {
  width: 10px;
}

.add-modal-grid::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.06);
  border-radius: 6px;
}

.add-form-column .field-label {
  display: block;
  margin-bottom: 6px;
  color: #cfe8ff;
  font-weight: 600;
}

.field-block {
  margin-top: 8px;
}

.add-side-column {
  display: flex;
  flex-direction: column;
  gap: 16px;
  align-items: center;
  /* ensure the side column doesn't force the main column to overflow
     and allow it to shrink when space is tight */
  min-width: 0;
}


.add-form-column {
  display: grid;
  grid-template-columns: 1.2fr 1fr;
  gap: 12px 18px;
}

.add-form-column .span-2 {
  grid-column: 1 / -1;
}

.two-col {
  display: contents;

}

.buffer-column {
  display: flex;
  flex-direction: column;
  gap: 12px;
  justify-content: space-between;
}

.preview-box {
  width: 100%;
  max-width: 320px;
  /* keep square preview using aspect-ratio so it scales nicely */
  aspect-ratio: 1 / 1;
  background: #2a3137;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  /* keep preview behind interactive form elements by default */
  z-index: 1000;
}

.preview-box .preview-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

/* smaller preview variant used in the edit dialog to avoid overlap */
.preview-box.preview-box--small {
  max-width: 180px;
  aspect-ratio: 1 / 1;
}

/* Prevent the preview box from intercepting clicks when it overlaps
   form controls on narrow viewports. The preview is passive (no
   interactions), so it's safe to let pointer events pass through. */
.preview-box {
  pointer-events: none;
}

/* Ensure form inputs and selects appear above the preview and can
   receive pointer events / open native dropdowns. */
.admin-input,
select.admin-input {
  position: relative;
  z-index: 1101;
  pointer-events: auto;
}

/* Responsive: stack preview under the form on smaller screens so it
   never visually overlaps form controls. This makes the dialog behave
   like the name/rank fields which occupy the main column. */
@media (max-width: 980px) {
  .add-modal-grid {
    grid-template-columns: 1fr;
  }

  .add-side-column {
    grid-column: 1 / -1;
    width: 100%;
    align-items: flex-start;
  }

  .preview-box {
    max-width: 100%;
    margin-top: 8px;
  }
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
  /* footer is placed after the scrolling content; don't rely on grid
     positioning here because the modal uses flex layout */
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  margin-top: 18px;
  flex: 0 0 auto;
}

.footer-left {
  display: flex;
  gap: 8px;
  align-items: center;
}

.footer-right {
  display: flex;
  gap: 12px;
  align-items: center;
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
