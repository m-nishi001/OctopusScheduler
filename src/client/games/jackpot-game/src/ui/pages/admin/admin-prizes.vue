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
      <button type="button" class="admin-btn icon-only export-icon" @click.prevent="exportFormatCsv"
        title="Export format CSV">
        <span class="emoji">📄</span>
      </button>
      <button type="button" class="admin-btn icon-only upload-icon" @click.prevent="openDataUploadDialog"
        title="Upload data">
        <span class="emoji">📤</span>
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
        <div class="prize-preview two-image">
          <template v-if="prize.imageAssetId || prize.image2AssetId">
            <div class="preview-half">
              <img v-if="prize.imageAssetId" :src="objectUrlMap.get(prize.imageAssetId) || prize.imageAssetId"
                alt="image1" class="preview-img" @error="onImageError" />
              <div v-else class="preview-placeholder small">画像1なし</div>
            </div>
            <div class="preview-half">
              <img v-if="prize.image2AssetId" :src="objectUrlMap.get(prize.image2AssetId) || prize.image2AssetId"
                alt="image2" class="preview-img" @error="onImageError" />
              <div v-else class="preview-placeholder small">画像2なし</div>
            </div>
          </template>
          <template v-else>
            <span>{{ prize.name }}</span>
          </template>
        </div>
        <div class="prize-info">
          <span>{{ prize.name }}</span>
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
            <label class="field-label">景品ランク</label>
            <input v-model.number="editRank" type="number" placeholder="景品ランク" min="1" class="admin-input" />
          </div>

          <div class="field-block left-col">
            <label class="field-label">抽選アニメーション</label>
            <select v-model="editAnimation" class="admin-input">
              <option value="roulette">ルーレット</option>
              <option value="slot">スロット</option>
            </select>
          </div>

          <div class="field-block">
            <label class="field-label">画像1</label>
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
                <input v-if="editImageMode === 'upload'" type="file" @change="onEditImageChange" accept="image/*"
                  class="admin-input" />
                <span v-if="editImageMode === 'upload' && editImageFilename" class="file-name">{{ editImageFilename
                  }}</span>
              </div>
            </div>
          </div>

          <div class="field-block">
            <label class="field-label">画像2</label>
            <div class="image-mode">
              <div class="image-radio-group">
                <label><input type="radio" v-model="editImage2Mode" value="upload" /> アップロード</label>
                <label><input type="radio" v-model="editImage2Mode" value="select" /> 既存から選択</label>
              </div>
              <div class="image-select-group">
                <select v-if="editImage2Mode === 'select'" v-model="editImage2AssetId" class="admin-input">
                  <option value="">選択なし</option>
                  <option v-for="asset in imageAssets" :key="asset.id" :value="asset.id">{{ asset.name }}</option>
                </select>
                <input v-if="editImage2Mode === 'upload'" type="file" @change="onEditImage2Change" accept="image/*"
                  class="admin-input" />
                <span v-if="editImage2Mode === 'upload' && editImage2Filename" class="file-name">{{ editImage2Filename
                  }}</span>
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
                <input v-if="editBgm1Mode === 'upload'" type="file" @change="onEditBgm1Change" accept="audio/*"
                  class="admin-input" />
                <span v-if="editBgm1Mode === 'upload' && editBgm1Filename" class="file-name">{{ editBgm1Filename
                  }}</span>
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
                <input v-if="editBgm2Mode === 'upload'" type="file" @change="onEditBgm2Change" accept="audio/*"
                  class="admin-input" />
                <span v-if="editBgm2Mode === 'upload' && editBgm2Filename" class="file-name">{{ editBgm2Filename
                  }}</span>
              </div>
            </div>
          </div>

        </div>

        <div class="add-side-column">
          <div class="preview-box preview-box--small two-image-preview">
            <template v-if="editImagePreview || editImage2Preview">
              <div class="preview-half">
                <img v-if="editImagePreview" :src="editImagePreview" alt="preview1" class="preview-img" />
                <div v-else class="preview-placeholder small">画像1なし</div>
              </div>
              <div class="preview-half">
                <img v-if="editImage2Preview" :src="editImage2Preview" alt="preview2" class="preview-img" />
                <div v-else class="preview-placeholder small">画像2なし</div>
              </div>
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
          <h3>🎁 新しい景品を追加</h3>
          <div class="field-block span-2">
            <div class="two-col">
              <div class="field-block">
                <label class="field-label">名前</label>
                <input v-model="newPrizeName" type="text" placeholder="景品名" class="admin-input prize-name-input" />
              </div>
              <div class="field-block">
                <label class="field-label">景品ランク</label>
                <input v-model.number="newPrizeRank" type="number" placeholder="景品ランク" min="1" class="admin-input" />
              </div>
            </div>
          </div>

          <div class="field-block span-2">
            <label class="field-label">画像1</label>
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
                <input v-if="newImageMode === 'upload'" type="file" @change="onNewImageChange" accept="image/*"
                  class="admin-input" />
                <span v-if="newImageMode === 'upload' && newImageFilename" class="file-name">{{ newImageFilename
                  }}</span>
              </div>
            </div>
          </div>

          <div class="field-block span-2">
            <label class="field-label">画像2</label>
            <div class="image-mode">
              <div class="image-radio-group">
                <label><input type="radio" v-model="newImage2Mode" value="upload" /> アップロード</label>
                <label><input type="radio" v-model="newImage2Mode" value="select" /> 既存から選択</label>
              </div>
              <div class="image-select-group">
                <select v-if="newImage2Mode === 'select'" v-model="newImage2AssetId" class="admin-input">
                  <option value="">選択なし</option>
                  <option v-for="asset in imageAssets" :key="asset.id" :value="asset.id">{{ asset.name }}</option>
                </select>
                <input v-if="newImage2Mode === 'upload'" type="file" @change="onNewImage2Change" accept="image/*"
                  class="admin-input" />
                <span v-if="newImage2Mode === 'upload' && newImage2Filename" class="file-name">{{ newImage2Filename
                  }}</span>
              </div>
            </div>
          </div>

          <div class="field-block left-col">
            <label class="field-label">抽選アニメーション</label>
            <select v-model="newPrizeAnimation" class="admin-input">
              <option value="roulette">ルーレット</option>
              <option value="slot">スロット</option>
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
                <input v-if="newBgm1Mode === 'upload'" type="file" @change="onNewBgm1Change" accept="audio/*"
                  class="admin-input" />
                <span v-if="newBgm1Mode === 'upload' && newBgm1Filename" class="file-name">{{ newBgm1Filename }}</span>
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
                <input v-if="newBgm2Mode === 'upload'" type="file" @change="onNewBgm2Change" accept="audio/*"
                  class="admin-input" />
                <span v-if="newBgm2Mode === 'upload' && newBgm2Filename" class="file-name">{{ newBgm2Filename }}</span>
              </div>
            </div>
          </div>
        </div>

        <div class="add-side-column">
          <div class="preview-box two-image-preview">
            <template v-if="newImagePreview || newImage2Preview">
              <div class="preview-half">
                <img v-if="newImagePreview" :src="newImagePreview" alt="preview1" class="preview-img" />
                <div v-else class="preview-placeholder small">画像1なし</div>
              </div>
              <div class="preview-half">
                <img v-if="newImage2Preview" :src="newImage2Preview" alt="preview2" class="preview-img" />
                <div v-else class="preview-placeholder small">画像2なし</div>
              </div>
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
          <button class="admin-btn" @click="confirmAdd" :disabled="!newPrizeName.trim() || adding">追加</button>
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
  <DataUploadDialog v-if="showDataUploadDialog" :show="showDataUploadDialog" type="prize"
    @close="showDataUploadDialog = false" @refresh="fetchPrizes" />
</template>
<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount, computed, watch } from 'vue';
import { Asset } from "@model/domains/drive-data/asset-data";
import { AssetDataService } from '@model/applications/asset/asset-data-service';
import { PrizeService } from '@model/applications/prize/prize-service';
import type { IPrizeRepository } from '@model/domains/prize/repository/i-prize-repository';

import { container } from 'tsyringe';
import { IPrizeRepositoryToken } from '@model/domains/prize/repository/i-prize-repository';
const prizeRepo = container.resolve<IPrizeRepository>(IPrizeRepositoryToken);
const assetDataService = container.resolve(AssetDataService);
const prizeService = container.resolve(PrizeService);
import DataUploadDialog from './components/data-upload-dialog.vue';
import { GasFunctionService } from '@common-lib/google-apps-script/gas-script-service';
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
const closeAddModal = () => { showAddModal.value = false; newPrizeName.value = ''; newPrizeRank.value = 5; newImageAsset.value = undefined; newImageAssetId.value = ''; newImageFilename.value = ''; newImagePreview.value = ''; newImage2AssetId.value = ''; newImage2Filename.value = ''; newImage2Preview.value = ''; newImage2Mode.value = 'upload'; tempAsset2.value = null; newBgm1AssetId.value = ''; newBgm2AssetId.value = ''; newBgm1Mode.value = 'select'; newBgm2Mode.value = 'select'; newBgm1Filename.value = ''; newBgm2Filename.value = ''; tempBgm1Asset.value = null; tempBgm2Asset.value = null; };
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
const newPrizeRank = ref<number>(5);
const newPrizeAnimation = ref('roulette');
const newImageMode = ref('upload');
const newImageAssetId = ref('');
const newImageAsset = ref<Asset | undefined>();
const newImageFilename = ref('');
const newImagePreview = ref('');
const newImage2Mode = ref('upload');
const newImage2AssetId = ref('');
const newImage2Filename = ref('');
const newImage2Preview = ref('');
const newBgm1AssetId = ref('');
const newBgm2AssetId = ref('');
const newBgm1Mode = ref('select');
const newBgm2Mode = ref('select');
const newBgm1Filename = ref('');
const newBgm2Filename = ref('');

const tempAsset = ref<Asset | null>(null);
const tempAsset2 = ref<Asset | null>(null);
const tempBgm1Asset = ref<Asset | null>(null);
const tempBgm2Asset = ref<Asset | null>(null);

const newImagePreviewUrl = ref<string | null>(null);
const newImage2PreviewUrl = ref<string | null>(null);
const editImagePreviewUrl = ref<string | null>(null);
const editImage2PreviewUrl = ref<string | null>(null);

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

const onNewImage2Change = async (e: Event) => {
  const file = (e.target as HTMLInputElement).files?.[0];
  if (file) {
    const dto = await assetDataService.createDriveDataDtoFromFile(file);
    tempAsset2.value = dto;
    newImage2Filename.value = file.name;
    if (newImage2PreviewUrl.value) {
      try { URL.revokeObjectURL(newImage2PreviewUrl.value); } catch { }
      newImage2PreviewUrl.value = null;
    }
    newImage2PreviewUrl.value = URL.createObjectURL(file);
    newImage2Preview.value = newImage2PreviewUrl.value;
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
  if (!newPrizeName.value.trim()) return;
  adding.value = true;
  const newPrize: any = {
    id: String(Date.now()),
    name: newPrizeName.value,
    rank: newPrizeRank.value,
    animation: newPrizeAnimation.value || 'roulette',
    order: prizes.value.length + 1
  };
  if (newImageMode.value === 'select' && newImageAssetId.value) {
    newPrize.imageAssetId = newImageAssetId.value;
    // Set object URL for selected image
    const selectedAsset = assets.value.find(a => a.id === newImageAssetId.value);
    if (selectedAsset) {
      try {
        const url = URL.createObjectURL(selectedAsset.blob);
        if (objectUrlMap.has(selectedAsset.id)) {
          try { URL.revokeObjectURL(objectUrlMap.get(selectedAsset.id) as string); } catch { }
        }
        objectUrlMap.set(selectedAsset.id, url);
      } catch (error) {
        console.warn('Failed to create object URL for selected image:', error);
      }
    }
  }
  if (newImage2Mode.value === 'select' && newImage2AssetId.value) {
    newPrize.image2AssetId = newImage2AssetId.value;
    // Set object URL for selected image2
    const selectedAsset2 = assets.value.find(a => a.id === newImage2AssetId.value);
    if (selectedAsset2) {
      try {
        const url2 = URL.createObjectURL(selectedAsset2.blob);
        if (objectUrlMap.has(selectedAsset2.id)) {
          try { URL.revokeObjectURL(objectUrlMap.get(selectedAsset2.id) as string); } catch { }
        }
        objectUrlMap.set(selectedAsset2.id, url2);
      } catch (error) {
        console.warn('Failed to create object URL for selected image2:', error);
      }
    }
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
    if (tempAsset2.value) {
      const updated2 = await assetDataService.addAssetData([tempAsset2.value]);
      const updatedAsset2 = updated2[0];
      newPrize.image2AssetId = updatedAsset2.id;
      try {
        const url2 = URL.createObjectURL(updatedAsset2.blob);
        if (objectUrlMap.has(updatedAsset2.id)) {
          try { URL.revokeObjectURL(objectUrlMap.get(updatedAsset2.id) as string); } catch { }
        }
        objectUrlMap.set(updatedAsset2.id, url2);
      } catch { }
      tempAsset2.value = null;
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
    newImage2Preview.value = '';
    newImage2Filename.value = '';
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

    // Prepare object URLs for prizes that reference assets via imageAssetId.
    for (const prize of fetchedPrizes) {
      if (prize.imageAssetId) {
        const asset = await assetDataService.getAssetDataById(prize.imageAssetId);
        if (asset && asset.id && !objectUrlMap.has(asset.id)) {
          try { objectUrlMap.set(asset.id, URL.createObjectURL(asset.blob)); } catch { }
        }
      }
      if (prize.image2AssetId) {
        const asset2 = await assetDataService.getAssetDataById(prize.image2AssetId);
        if (asset2 && asset2.id && !objectUrlMap.has(asset2.id)) {
          try { objectUrlMap.set(asset2.id, URL.createObjectURL(asset2.blob)); } catch { }
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
    const service = new GasFunctionService('addJson');
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
    const service = new GasFunctionService('getJson');
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
const editRank = ref<number>(5);
const editImageAssetId = ref('');
const editImagePreview = ref('');
const editImageMode = ref('upload');
const editImageFilename = ref('');
const editImage2AssetId = ref('');
const editImage2Mode = ref('upload');
const editImage2Filename = ref('');
const editImage2Preview = ref('');
const editBgm1AssetId = ref('');
const editBgm2AssetId = ref('');
const editBgm1Mode = ref('select');
const editBgm2Mode = ref('select');
const editBgm1Filename = ref('');
const editBgm2Filename = ref('');
const editAnimation = ref('roulette');

const editTempAsset = ref<Asset | null>(null);
const editTempAsset2 = ref<Asset | null>(null);
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

const onEditImage2Change = async (e: Event) => {
  const file = (e.target as HTMLInputElement).files?.[0];
  if (file) {
    const dto = await assetDataService.createDriveDataDtoFromFile(file);
    editTempAsset2.value = dto;
    editImage2Filename.value = file.name;
    if (editImage2PreviewUrl.value) {
      try { URL.revokeObjectURL(editImage2PreviewUrl.value); } catch { }
      editImage2PreviewUrl.value = null;
    }
    editImage2PreviewUrl.value = URL.createObjectURL(file);
    editImage2Preview.value = editImage2PreviewUrl.value;
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
  } else {
    // No asset for this prize; default to upload mode. Any legacy inline data
    // URL should be handled by infrastructure migration; client does not
    // process inline data URLs.
    editImageMode.value = 'upload';
  }
  editImageFilename.value = '';
  editTempAsset.value = null;
  if (prize.image2AssetId) {
    editImage2Mode.value = 'select';
    editImage2AssetId.value = prize.image2AssetId;
    editImage2Preview.value = objectUrlMap.get(prize.image2AssetId) || prize.image2AssetId;
    try {
      const exists2 = assets.value.find((a: any) => a.id === prize.image2AssetId);
      if (!exists2) {
        const fetched2 = await assetDataService.getAssetDataById(prize.image2AssetId);
        if (fetched2) assets.value.push(fetched2);
      }
    } catch (e) {
      console.warn('Failed to fetch image2 asset for edit select:', e);
    }
  } else {
    editImage2Mode.value = 'upload';
  }
  editImage2Filename.value = '';
  editTempAsset2.value = null;
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
  let image2AssetId: string | undefined;
  if (editTempAsset2.value) {
    const updatedAssets2 = await assetDataService.addAssetData([editTempAsset2.value]);
    editTempAsset2.value = updatedAssets2[0];
    image2AssetId = editTempAsset2.value.id;
    try {
      const url2 = URL.createObjectURL(editTempAsset2.value.blob);
      if (objectUrlMap.has(editTempAsset2.value.id)) {
        try { URL.revokeObjectURL(objectUrlMap.get(editTempAsset2.value.id) as string); } catch { }
      }
      objectUrlMap.set(editTempAsset2.value.id, url2);
    } catch { }
  }

  // No inline data URL migration here; migration should be handled by
  // infrastructure so the client does not attempt to process inline data URLs on save.
  const updatedPrize = {
    ...editPrizeData.value,
    name: editName.value,
    rank: editRank.value,
    animation: editAnimation.value,
    imageAssetId: assetId || editImageAssetId.value,
    image2AssetId: image2AssetId || editImage2AssetId.value,
    bgm1AssetId: bgm1AssetId || editBgm1AssetId.value,
    bgm2AssetId: bgm2AssetId || editBgm2AssetId.value,
  };
  try {
    await prizeService.updatePrize(updatedPrize.id, updatedPrize);
    await fetchPrizes();
    editPrizeData.value = null;
    editName.value = '';
    editRank.value = 5;
    editImageAssetId.value = '';
    editImagePreview.value = '';
    editImageFilename.value = '';
    editTempAsset.value = null;
    editImage2AssetId.value = '';
    editImage2Preview.value = '';
    editImage2Filename.value = '';
    editTempAsset2.value = null;
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

// Watch for new image asset selection changes
watch([newImageAssetId, () => newImageMode.value], async ([newId, mode]) => {
  if (mode === 'select' && newId) {
    const asset = assets.value.find(a => a.id === newId);
    if (asset) {
      // Clean up previous preview URL
      if (newImagePreviewUrl.value) {
        try { URL.revokeObjectURL(newImagePreviewUrl.value); } catch { }
        newImagePreviewUrl.value = null;
      }
      newImagePreviewUrl.value = URL.createObjectURL(asset.blob);
      newImagePreview.value = newImagePreviewUrl.value;
    }
  } else if (mode === 'upload') {
    // Clear preview when switching to upload mode (unless file is selected)
    if (!newImageFilename.value) {
      newImagePreview.value = '';
    }
  }
});

// Watch for new image2 asset selection changes
watch([newImage2AssetId, () => newImage2Mode.value], async ([newId, mode]) => {
  if (mode === 'select' && newId) {
    const asset = assets.value.find(a => a.id === newId);
    if (asset) {
      if (newImage2PreviewUrl.value) {
        try { URL.revokeObjectURL(newImage2PreviewUrl.value); } catch { }
        newImage2PreviewUrl.value = null;
      }
      newImage2PreviewUrl.value = URL.createObjectURL(asset.blob);
      newImage2Preview.value = newImage2PreviewUrl.value;
    }
  } else if (mode === 'upload') {
    if (!newImage2Filename.value) {
      newImage2Preview.value = '';
    }
  }
});

// Watch for edit image asset selection changes
watch([editImageAssetId, () => editImageMode.value], async ([newId, mode]) => {
  if (mode === 'select' && newId) {
    const asset = assets.value.find(a => a.id === newId);
    if (asset) {
      // Clean up previous preview URL
      if (editImagePreviewUrl.value) {
        try { URL.revokeObjectURL(editImagePreviewUrl.value); } catch { }
        editImagePreviewUrl.value = null;
      }
      editImagePreviewUrl.value = URL.createObjectURL(asset.blob);
      editImagePreview.value = editImagePreviewUrl.value;
    }
  } else if (mode === 'upload') {
    // Clear preview when switching to upload mode (unless file is selected)
    if (!editImageFilename.value) {
      editImagePreview.value = '';
    }
  }
});

// Watch for edit image2 asset selection changes
watch([editImage2AssetId, () => editImage2Mode.value], async ([newId, mode]) => {
  if (mode === 'select' && newId) {
    const asset = assets.value.find(a => a.id === newId);
    if (asset) {
      if (editImage2PreviewUrl.value) {
        try { URL.revokeObjectURL(editImage2PreviewUrl.value); } catch { }
        editImage2PreviewUrl.value = null;
      }
      editImage2PreviewUrl.value = URL.createObjectURL(asset.blob);
      editImage2Preview.value = editImage2PreviewUrl.value;
    }
  } else if (mode === 'upload') {
    if (!editImage2Filename.value) {
      editImage2Preview.value = '';
    }
  }
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
      // Before replacing local assets, build a map of existing asset signature -> id
      // so we can attempt to restore prize references after replacement.
      const oldAssets = await assetDataService.getAllAssetData();
      const oldSignatureToId = new Map<string, string>();
      for (const a of oldAssets) {
        const sig = `${a.name}:${a.size}`;
        oldSignatureToId.set(sig, a.id);
      }

      let idMap: { [oldId: string]: string } | undefined;
      if (typeof (assetDataService as any).replaceLocalWithDrive === 'function') {
        const res = await (assetDataService as any).replaceLocalWithDrive((message: string) => { syncMessage.value = message; });
        idMap = res?.idMap;
      } else {
        await downloadPrizesJsonFromDrive();
      }

      // After replace, fetch new assets and build signature -> id map
      await fetchAssets();
      const newAssets = assets.value || [];
      const newSignatureToId = new Map<string, string>();
      for (const a of newAssets) {
        const sig = `${a.name}:${a.size}`;
        newSignatureToId.set(sig, a.id);
      }

      // If replaceLocalWithDrive returned an idMap of oldId->newId, use it
      // directly for prize updates, otherwise use signature heuristics.
      const existingPrizes = await prizeRepo.getPrizes();
      const updatedPrizes: any[] = [];
      for (const p of existingPrizes) {
        let updated = false;
        const updatedPrize = { ...p } as any;
        const checkAndReplace = (field: string) => {
          const currentId = (updatedPrize as any)[field];
          if (!currentId) return;
          if (idMap && idMap[currentId]) {
            (updatedPrize as any)[field] = idMap[currentId];
            updated = true;
            return;
          }
          // fallback: try signature based mapping
          const old = oldAssets.find((o: any) => o.id === currentId);
          if (!old) return;
          const sig = `${old.name}:${old.size}`;
          const newId = newSignatureToId.get(sig);
          if (newId && newId !== currentId) {
            (updatedPrize as any)[field] = newId;
            updated = true;
          }
        };
        checkAndReplace('imageAssetId');
        checkAndReplace('image2AssetId');
        checkAndReplace('bgm1AssetId');
        checkAndReplace('bgm2AssetId');
        if (updated) {
          // persist updated prize replacing previous
          try {
            await prizeService.updatePrize(updatedPrize.id, updatedPrize);
            updatedPrizes.push(updatedPrize);
          } catch (e) {
            console.warn('performReplaceFromDrive: failed to update prize', updatedPrize.id, e);
          }
        }
      }
      if (updatedPrizes.length) {
        console.log('performReplaceFromDrive: updated prizes to new asset ids', updatedPrizes.map(p => p.id));
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
  if (newImage2PreviewUrl.value) {
    try { URL.revokeObjectURL(newImage2PreviewUrl.value); } catch { }
  }
  if (editImagePreviewUrl.value) {
    try { URL.revokeObjectURL(editImagePreviewUrl.value); } catch { }
  }
  if (editImage2PreviewUrl.value) {
    try { URL.revokeObjectURL(editImage2PreviewUrl.value); } catch { }
  }

  try {
    objectUrlMap.forEach((url) => {
      try { URL.revokeObjectURL(url); } catch { }
    });
    objectUrlMap.clear();
  } catch { }
});

const exportFormatCsv = () => {
  const csv = '名前,ランク,アニメーション,画像1ファイル名,画像2ファイル名,BGM1ファイル名,BGM2ファイル名\n';
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'prizes_format.csv';
  a.click();
  URL.revokeObjectURL(url);
};

const showDataUploadDialog = ref(false);
const openDataUploadDialog = () => { showDataUploadDialog.value = true; };
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

.prize-preview.two-image {
  display: flex;
  padding: 0;
}

.two-image .preview-half,
.two-image-preview .preview-half {
  width: 50%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  background: transparent;
}

.two-image .preview-half .preview-img,
.two-image-preview .preview-half .preview-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.preview-placeholder.small {
  font-size: 0.82rem;
  color: #9fb8db;
  padding: 6px;
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
  padding: 12px 16px;
  border-radius: 10px;
  border: 1px solid rgba(255, 255, 255, 0.2);
  background: rgba(255, 255, 255, 0.05);
  color: #fff;
  font-size: 0.96rem;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  transition: all 0.2s ease;
}

.admin-input:focus {
  outline: none;
  border-color: #4f8cff;
  box-shadow: 0 0 0 3px rgba(79, 140, 255, 0.2);
  background: rgba(255, 255, 255, 0.08);
}

.admin-btn {
  padding: 12px 24px;
  border-radius: 12px;
  border: none;
  background: linear-gradient(135deg, #4f8cff 0%, #aee1ff 100%);
  color: #232b36;
  font-weight: 700;
  cursor: pointer;
  transition: all 0.3s ease;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  box-shadow: 0 4px 12px rgba(79, 140, 255, 0.2);
}

.admin-btn:hover {
  box-shadow: 0 8px 20px rgba(79, 140, 255, 0.3);
  transform: translateY(-2px);
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
  flex-direction: column;
  gap: 12px;
}

.image-mode label {
  display: flex;
  align-items: center;
  gap: 8px;
  color: #fff;
  cursor: pointer;
}

.bgm-mode {
  display: flex;
  flex-direction: column;
  gap: 12px;
  align-items: flex-start;
}

.bgm-mode label {
  color: #fff;
  font-weight: 500;
  cursor: pointer;
}

.bgm-radio-group {
  display: flex;
  gap: 16px;
  align-items: center;
}

.bgm-radio-group label {
  white-space: nowrap;
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.image-radio-group {
  display: flex;
  gap: 16px;
  align-items: center;
}

.image-radio-group label {
  white-space: nowrap;
  display: inline-flex;
  align-items: center;
  gap: 6px;
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
  /* provide some padding so very small viewports don't stick the dialog to edges */
  padding: 24px;

}

.modal-overlay::-webkit-scrollbar {
  width: 0;
  height: 0;
}

.modal-content {
  background: linear-gradient(135deg, #232b36 0%, #2a3441 100%);
  color: #fff;
  padding: 28px;
  border-radius: 16px;
  text-align: left;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5);
  max-width: 700px;
  width: 90%;
  border: 1px solid rgba(255, 255, 255, 0.1);
}


.modal-content.wide-modal {
  width: 75vw;
  max-width: none;
  flex: 0 0 75vw;
  margin: 0 auto;

  /* allow the dialog to grow but never overflow the viewport
     keep internal scrolling inside the grid area */
  max-height: calc(100vh - 100px);
  height: auto;
  display: flex;
  flex-direction: column;
}

.add-modal-grid {
  display: grid;
  /* make the preview column responsive: allow it to grow up to 350px
    but stay at least 250px so the preview remains useful */
  grid-template-columns: 1fr minmax(230px, 320px);
  gap: 20px;
  align-items: start;
  margin-top: 16px;

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
  margin-bottom: 8px;
  color: #dbeeff;
  font-weight: 600;
  font-size: 0.95rem;
}

.field-block {
  margin-top: 12px;
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
  background: linear-gradient(135deg, #2a3137 0%, #343d4a 100%);
  border-radius: 16px;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  /* keep preview behind interactive form elements by default */
  z-index: 1000;
  border: 2px solid rgba(255, 255, 255, 0.1);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.3);
}

.preview-box .preview-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

/* smaller preview variant used in the edit dialog to avoid overlap */
.preview-box.preview-box--small {
  max-width: 200px;
  aspect-ratio: 1 / 1;
}

/* Prevent the preview box from intercepting clicks when it overlaps
   form controls on narrow viewports. The preview is passive (no
   interactions), so it's safe to let pointer events pass through. */
.preview-box {
  pointer-events: none;
}

select.admin-input {
  background: rgba(255, 255, 255, 0.05);
  color: #fff;
  appearance: none;
  -webkit-appearance: none;
  -moz-appearance: none;
  background-image: url("data:image/svg+xml;charset=UTF-8,%3csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%23fff' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3e%3cpolyline points='6,9 12,15 18,9'%3e%3c/polyline%3e%3c/svg%3e");
  background-repeat: no-repeat;
  background-position: right 12px center;
  background-size: 16px;
  padding-right: 40px;
  min-width: 200px;
}

select.admin-input:focus {
  background: rgba(255, 255, 255, 0.08);
}

select.admin-input option {
  background: #232b36;
  color: #fff;
  padding: 8px;
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
  color: #9fb8db;
  font-size: 1.1rem;
  font-weight: 500;
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
  margin-top: 20px;
  flex: 0 0 auto;
  padding-top: 20px;
  border-top: 1px solid rgba(255, 255, 255, 0.1);
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
  background: linear-gradient(135deg, #3b4650 0%, #4a5560 100%);
  color: #fff;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
}

.cancel-primary:hover {
  box-shadow: 0 8px 20px rgba(0, 0, 0, 0.3);
  transform: translateY(-2px);
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

.bgm-select-group {
  min-width: 240px;
  width: 100%;
}

.bgm-file-input-wrap {
  display: flex;
  flex-direction: column;
  gap: 8px;
  width: 100%;
}

.bgm-file-input-wrap .admin-input[type="file"] {
  padding: 8px 12px;
  min-width: 200px;
}

.image-select-group {
  min-width: 240px;
  width: 100%;
}

.image-file-input-wrap {
  display: flex;
  flex-direction: column;
  gap: 8px;
  width: 100%;
}

.image-file-input-wrap .admin-input[type="file"] {
  padding: 8px 12px;
  min-width: 200px;
}
</style>
