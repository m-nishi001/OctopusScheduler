<template>
  <div class="admin-section">
    <h2>メンバー設定</h2>
    <div class="admin-actions">
      <button type="button" class="admin-btn icon-only add-icon" @click.prevent="openModal('add')" title="Add members">
        <span class="emoji">➕</span>
      </button>
      <button class="admin-btn icon-only sync-icon" @click.prevent="openMemberSyncModal" title="Sync members">
        <span class="emoji">🔄</span>
      </button>
      <button class="admin-btn icon-only delete-icon" @click="openDeleteModal"
        :disabled="!selectedMembers.length || deleting" title="Delete selected">
        <span class="emoji">🗑️</span>
      </button>

      <!-- Sync actions are handled via modal (matches admin-assets) -->
    </div>
    <div v-if="members.length" class="list-controls">
      <label class="select-all-label">
        <input type="checkbox" v-model="isAllSelected" class="select-all-checkbox" />
        <span class="sr-only">全選択</span>
      </label>
    </div>

    <ul v-if="members.length" class="admin-list">
      <li v-for="member in members" :key="member.id" class="admin-list-item">
        <input type="checkbox" v-model="selectedMembers" :value="member.id" />
        <div class="member-preview">
          <img v-if="member.photoAssetId || member.photoAsset" :src="getMemberImageSrc(member)" alt="photo"
            class="preview-img" />
          <span v-else>{{ member.name }}</span>
        </div>
        <div class="member-info">
          <span>{{ member.name }}</span>
        </div>
        <button class="admin-btn ml-2" @click="openModal('edit', member)">詳細</button>
        <button class="admin-btn ml-2 delete-btn" @click="deleteMember(member.id)">削除</button>
      </li>
    </ul>
    <div v-else class="empty-state">
      メンバーはいません
    </div>
  </div>

  <!-- 追加/編集モーダル -->
  <div v-if="modalMode" class="modal-overlay">
    <div class="modal-content wide-modal" @click.stop>
      <div class="add-modal-grid">
        <!-- Left: buffer list (only for add mode) -->
        <div class="buffer-column" v-if="modalMode === 'add'">
          <h3>追加するメンバー</h3>
          <div class="buffer-list">
            <div v-for="(b, idx) in addBuffer" :key="idx" class="buffer-item"
              :class="{ active: selectedBufferIndex === idx }" @click="selectedBufferIndex = idx">
              <span class="buffer-name">{{ b.name || '新しいメンバー' }}</span>
              <button class="admin-btn" @click.stop.prevent="removeBuffer(idx)">×</button>
            </div>
            <div v-if="addBuffer.length === 0" style="color:#cfe8ff;padding:8px">+ を押して新しいメンバーを追加してください</div>
          </div>
          <!-- buffer actions moved to modal footer so they align with Cancel -->
        </div>

        <!-- Middle: form -->
        <div class="add-form-column">
          <h3>{{ modalMode === 'edit' ? 'メンバー詳細' : 'メンバーを追加' }}</h3>
          <p v-if="modalMode === 'add'">左のリストからメンバーを選択して内容を編集できます。新しいメンバーは＋で追加。</p>

          <!-- when in add mode and a buffer item is selected, edit that buffer item -->
          <template v-if="modalMode === 'add'">
            <div v-if="addBuffer.length">
              <div v-if="selectedBufferIndex !== null">
                <div class="two-col">
                  <div class="field-block">
                    <label class="field-label">名前</label>
                    <input v-model="addBuffer[selectedBufferIndex].name" type="text" placeholder="メンバー名"
                      class="admin-input member-name-input" />
                  </div>
                  <div class="field-block">
                    <label class="field-label">ランク</label>
                    <input v-model.number="addBuffer[selectedBufferIndex].rank" type="number" placeholder="ランク" min="1"
                      :max="modalMaxRank" step="1" class="admin-input" />
                  </div>
                </div>
                <div class="field-block">
                  <label class="field-label">写真</label>
                  <div class="photo-mode">
                    <label><input type="radio" v-model="addBuffer[selectedBufferIndex].photoMode" value="upload" />
                      アップロード</label>
                    <label><input type="radio" v-model="addBuffer[selectedBufferIndex].photoMode" value="select" />
                      既存から選択</label>
                  </div>
                  <div style="margin-top:10px">
                    <input v-if="addBuffer[selectedBufferIndex].photoMode === 'upload'" type="file"
                      @change="onBufferFileChange($event, selectedBufferIndex)" accept="image/*" class="admin-input" />
                    <div v-if="bufferPreviewMap.get(selectedBufferIndex)" class="file-name" style="margin-top:8px">
                      <img :src="bufferPreviewMap.get(selectedBufferIndex)"
                        style="width:72px;height:72px;object-fit:cover;border-radius:6px" />
                    </div>
                    <select v-if="addBuffer[selectedBufferIndex].photoMode === 'select'"
                      v-model="addBuffer[selectedBufferIndex].photoAssetId" class="admin-input" style="margin-top:8px">
                      <option value="">選択なし</option>
                      <option v-for="asset in imageAssets" :key="asset.id" :value="asset.id">{{ asset.name }}</option>
                    </select>
                  </div>
                </div>
              </div>
              <div v-else style="color:#cfe8ff">編集するメンバーを左のリストから選択してください。</div>
            </div>
            <div v-else style="color:#cfe8ff">+ を押して新しいメンバーを追加してください</div>
          </template>

          <!-- edit single member mode -->
          <template v-if="modalMode === 'edit'">
            <div class="two-col">
              <div class="field-block">
                <label class="field-label">名前</label>
                <input v-model="modalName" type="text" placeholder="メンバー名" class="admin-input member-name-input" />
              </div>

              <div class="field-block">
                <label class="field-label">ランク</label>
                <input v-model.number="modalRank" type="number" placeholder="ランク" min="1" :max="modalMaxRank" step="1"
                  class="admin-input" />
              </div>
            </div>

            <div class="field-block">
              <label class="field-label">写真</label>
              <div class="photo-mode">
                <label><input type="radio" v-model="modalPhotoMode" value="upload" /> アップロード</label>
                <label><input type="radio" v-model="modalPhotoMode" value="select" /> 既存から選択</label>
              </div>
              <div style="margin-top:10px">
                <input v-if="modalPhotoMode === 'upload'" type="file" @change="onModalPhotoChange" accept="image/*"
                  class="admin-input" />
                <div v-if="modalPhotoMode === 'upload' && modalPhotoFilename" class="file-name">{{ modalPhotoFilename }}
                </div>
                <select v-if="modalPhotoMode === 'select'" v-model="photoAssetId" class="admin-input"
                  style="margin-top:8px">
                  <option value="">選択なし</option>
                  <option v-for="asset in imageAssets" :key="asset.id" :value="asset.id">{{ asset.name }}</option>
                </select>
              </div>
            </div>
          </template>

          <!-- preview area (moved into the form column) -->
          <div class="preview-in-form" style="margin-top:16px"
            v-if="modalMode === 'edit' || (modalMode === 'add' && selectedBufferIndex !== null)">
            <div class="preview-box">
              <template v-if="modalMode === 'edit'">
                <template v-if="modalPhotoPreview">
                  <img :src="modalPhotoPreview" alt="preview" class="preview-img" />
                </template>
                <template v-else>
                  <div class="preview-placeholder">プレビュー</div>
                </template>
              </template>
              <template v-else>
                <!-- preview for selected buffer -->
                <template v-if="selectedBufferIndex !== null && getBufferPreviewSrc(selectedBufferIndex)">
                  <img :src="getBufferPreviewSrc(selectedBufferIndex)" alt="preview" class="preview-img" />
                </template>
                <template v-else>
                  <div class="preview-placeholder">プレビュー</div>
                </template>
              </template>
            </div>
          </div>

        </div>
      </div>

      <!-- Preview is now part of the form column (see above) -->

      <div class="modal-footer">
        <div class="footer-left">
          <template v-if="modalMode === 'add'">
            <button class="admin-btn" @click.prevent="addBufferRow">＋</button>
            <button class="admin-btn" @click.prevent="bulkSaveMembers" :disabled="!addBuffer.length">保存</button>
            <button class="admin-btn cancel-primary" @click.prevent="clearBuffer">クリア</button>
          </template>
        </div>

        <div class="footer-right admin-modal-buttons">
          <button v-if="modalMode === 'edit'" class="admin-btn" @click="confirmModal"
            :disabled="!modalName.trim() || modalRank < 1 || adding">保存</button>
          <button class="admin-btn cancel-primary" @click="closeModal">キャンセル</button>
        </div>
      </div>
    </div>
  </div>

  <!-- メンバー同期モード選択 -->
  <div v-if="showMemberSyncModal" class="modal-overlay">
    <div class="modal-content">
      <h3>メンバー同期モードを選択</h3>
      <p>ローカルとDriveのどちらを優先しますか？</p>
      <div class="modal-actions">
        <button class="admin-btn" @click.prevent="confirmMemberSyncMode('local')">ローカル優先 (Local wins)</button>
        <button class="admin-btn sync-btn" @click.prevent="confirmMemberSyncMode('drive')">Drive優先 (Drive wins)</button>
        <button class="admin-btn delete-btn" @click.prevent="showMemberSyncModal = false">キャンセル</button>
      </div>
    </div>
  </div>

  <!-- 置換警告モーダル (Drive優先を選んだとき) -->
  <div v-if="showReplaceWarningModal" class="modal-overlay">
    <div class="modal-content">
      <h3>注意: ローカルデータを置換します</h3>
      <p>Drive のコンテンツに合わせてローカルのメンバーを置換します。既存のローカルデータは削除されます。続行しますか？</p>
      <div class="modal-actions">
        <button class="admin-btn delete-btn" @click.prevent="showReplaceWarningModal = false">キャンセル</button>
        <button class="admin-btn sync-btn" @click.prevent="performReplaceFromDrive">置換して同期する</button>
      </div>
    </div>
  </div>

  <!-- 削除確認モーダル -->
  <div v-if="showDeleteModal" class="modal-overlay">
    <div class="modal-content">
      <h3>メンバーを削除</h3>
      <p>選択したメンバーを削除しますか？</p>
      <div class="modal-actions">
        <button class="admin-btn delete-btn" @click="confirmDeleteSelected">削除</button>
        <button class="admin-btn" @click="closeDeleteModal">キャンセル</button>
      </div>
    </div>
  </div>

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
      <p>{{ syncMessage || "メンバーを同期しています。しばらくお待ちください。" }}</p>
      <div class="spinner"></div>
    </div>
  </div>
  <AssetSelectionDialog v-if="showAssetDialog" @close="showAssetDialog = false" @selected="onAssetsSelected" />
</template>
<script setup lang="ts">
import { ref, onMounted, computed, watch, onBeforeUnmount } from 'vue';
import type { IMemberRepository } from '../../../model/domains/member/repository/i-member-repository';
import type { Asset } from '../../../model/domains/drive-data/asset-data';
import { AssetDataService } from '../../../model/applications/asset/asset-data-service';
import { MemberService } from '../../../model/applications/member/member-service';
import type { MemberDto } from "../../../model/applications/member/dto/member-dto";

import { container } from 'tsyringe';
import AssetSelectionDialog from './components/asset-selection-dialog.vue';
import { GasFunctionService } from '/root/google_apps_script/octopus-scheduler/src/client/packages/common-lib/src/google-apps-script/gas-script-service.ts';
const memberRepo = container.resolve<IMemberRepository>("IMemberRepository");
const assetDataService = container.resolve<AssetDataService>("AssetDataService");
const memberService = container.resolve(MemberService);
const members = ref<any[]>([]);
const showAssetDialog = ref(false);
const selectedMembers = ref<string[]>([]);
const assets = ref<Asset[]>([]);
const imageAssets = computed(() => assets.value.filter((asset) => asset.blob.type.startsWith('image')));
// map to hold object URLs for member photos keyed by asset id
const objectUrlMap = new Map<string, string>();
const getMemberImageSrc = (member: any) => {
  return member.photoAssetId ? objectUrlMap.get(member.photoAssetId) || '' : '';
};

const isAllSelected = computed({
  get: () => {
    return members.value.length > 0 && selectedMembers.value.length === members.value.length;
  },
  set: (val: boolean) => {
    if (val) {
      selectedMembers.value = members.value.map(m => m.id);
    } else {
      selectedMembers.value = [];
    }
  }
});

// modal state
const modalMode = ref<'add' | 'edit' | null>(null);
const modalData = ref<any>(null);
const modalName = ref('');
const modalRank = ref(1);
const modalMaxRank = ref(1);
const modalPhotoMode = ref('upload');
const modalPhotoAsset = ref<Asset | undefined>();
const modalPhotoPreview = ref('');
let modalPhotoPreviewUrl: string | undefined;
const modalPhotoFilename = ref('');
const photoAssetId = ref('');
const tempAsset = ref<Asset | null>(null);
// buffer for multi-add
const addBuffer = ref<Array<{ name: string; rank: number; photoAsset?: Asset | null; photoAssetId?: string; photoMode?: string }>>([]);
// currently selected buffer index in the left list
const selectedBufferIndex = ref<number | null>(null);
// per-buffer preview URLs (keyed by buffer index)
const bufferPreviewMap = new Map<number, string>();

const onBufferFileChange = async (e: Event, idx: number) => {
  const file = (e.target as HTMLInputElement).files?.[0];
  if (!file) return;
  try {
    const dto = await assetDataService.createDriveDataDtoFromFile(file);
    const entry = addBuffer.value[idx];
    if (entry) {
      entry.photoAsset = dto;
      // create preview URL
      try { const url = URL.createObjectURL(file); bufferPreviewMap.set(idx, url); } catch { }
    }
  } catch (err) {
    console.error('Failed to create buffer asset DTO', err);
  }
};

// modal actions
const openModal = (mode: 'add' | 'edit', data?: any) => {
  modalMode.value = mode;
  modalData.value = data || null;
  if (mode === 'add') {
    modalName.value = '';
    modalRank.value = members.value.length + 1;
    modalMaxRank.value = 10;
    modalPhotoMode.value = 'upload';
    modalPhotoAsset.value = undefined;
    modalPhotoPreview.value = '';
    modalPhotoFilename.value = '';
    photoAssetId.value = '';
    tempAsset.value = null;
    addBuffer.value = [];
  } else if (mode === 'edit' && data) {
    modalName.value = data.name;
    modalRank.value = data.rank;
    modalMaxRank.value = 10;
    if (data.photoAssetId) {
      modalPhotoMode.value = 'select';
      photoAssetId.value = data.photoAssetId;
      modalPhotoPreview.value = objectUrlMap.get(data.photoAssetId) || '';
    } else {
      modalPhotoMode.value = 'upload';
      modalPhotoAsset.value = data.photoAsset;
      if (modalPhotoAsset.value) {
        if (modalPhotoPreviewUrl) {
          try { URL.revokeObjectURL(modalPhotoPreviewUrl); } catch { }
          modalPhotoPreviewUrl = undefined;
        }
        modalPhotoPreviewUrl = URL.createObjectURL(modalPhotoAsset.value.blob);
        modalPhotoPreview.value = modalPhotoPreviewUrl;
      } else {
        modalPhotoPreview.value = '';
      }
    }
  }
};
const closeModal = () => {
  modalMode.value = null;
  modalData.value = null;
  modalName.value = '';
  modalRank.value = 1;
  modalMaxRank.value = 1;
  modalPhotoAsset.value = undefined;
  modalPhotoPreview.value = '';
  modalPhotoFilename.value = '';
  photoAssetId.value = '';
  tempAsset.value = null;
};
const confirmModal = async () => {
  if (modalMode.value === 'add') {
    // Default: single add (legacy behaviour)
    await addMember();
  } else if (modalMode.value === 'edit') {
    if (!modalData.value) return;
    const updatedMember = {
      ...modalData.value,
      name: modalName.value,
      rank: modalRank.value
    };
    try {
      // If upload mode, ensure asset is properly stored and photoAssetId set
      if (modalPhotoMode.value === 'upload' && modalPhotoAsset.value) {
        try {
          const uploaded = await assetDataService.addAssetData([modalPhotoAsset.value]);
          if (uploaded && uploaded[0] && uploaded[0].id) {
            updatedMember.photoAssetId = uploaded[0].id;
          }
        } catch (e) {
          console.error('Failed to upload photo asset during edit:', e);
        }
      } else if (modalPhotoMode.value === 'select' && photoAssetId.value) {
        updatedMember.photoAssetId = photoAssetId.value;
      }

      await memberRepo.updateMembers([{ id: updatedMember.id, updateFn: () => updatedMember }]);
      await fetchMembers();
      await saveMembersToLocalJson();
    } catch (error) {
      console.error("Failed to update member:", error);
    }
  }
  closeModal();
};

// delete modal state
const showDeleteModal = ref(false);
const openDeleteModal = () => { showDeleteModal.value = true; };
const closeDeleteModal = () => { showDeleteModal.value = false; };
const confirmDeleteSelected = async () => { await deleteSelectedMembers(); closeDeleteModal(); };

// status
const adding = ref(false);
const deleting = ref(false);
const deleteMessage = ref("");
const syncing = ref(false);
const syncMessage = ref("");

const updateModalPhotoPreview = async () => {
  // revoke previous preview url if any
  if (modalPhotoPreviewUrl) {
    try { URL.revokeObjectURL(modalPhotoPreviewUrl); } catch { }
    modalPhotoPreviewUrl = undefined;
  }

  if (modalPhotoAsset.value) {
    modalPhotoPreviewUrl = URL.createObjectURL(modalPhotoAsset.value.blob);
    modalPhotoPreview.value = modalPhotoPreviewUrl;
  } else if (photoAssetId.value) {
    const asset = await assetDataService.getAssetDataById(photoAssetId.value);
    if (asset) {
      modalPhotoPreviewUrl = URL.createObjectURL(asset.blob);
      modalPhotoPreview.value = modalPhotoPreviewUrl;
    } else {
      modalPhotoPreview.value = '';
    }
  } else {
    modalPhotoPreview.value = '';
  }
};

const onModalPhotoChange = async (e: Event) => {
  const file = (e.target as HTMLInputElement).files?.[0];
  if (file) {
    const dto = await assetDataService.createDriveDataDtoFromFile(file);
    tempAsset.value = dto;
    modalPhotoAsset.value = dto;
    modalPhotoFilename.value = file.name;

    // revoke previous
    if (modalPhotoPreviewUrl) {
      try { URL.revokeObjectURL(modalPhotoPreviewUrl); } catch { };
    }
    modalPhotoPreviewUrl = URL.createObjectURL(file);
    modalPhotoPreview.value = modalPhotoPreviewUrl;
  }
};

// return a preview src for a buffer index (uploaded preview first, then existing asset object URL)
const getBufferPreviewSrc = (idx: number | null) => {
  if (idx === null) return '';
  const url = bufferPreviewMap.get(idx);
  if (url) return url;
  const assetId = addBuffer.value[idx]?.photoAssetId;
  if (assetId) return objectUrlMap.get(assetId) || '';
  return '';
};

onBeforeUnmount(() => {
  if (modalPhotoPreviewUrl) {
    try { URL.revokeObjectURL(modalPhotoPreviewUrl); } catch { };
    modalPhotoPreviewUrl = undefined;
  }
  // revoke any object URLs created for member photos
  try {
    for (const url of objectUrlMap.values()) {
      try { URL.revokeObjectURL(url); } catch { }
    }
    objectUrlMap.clear();
    // revoke buffer preview urls
    for (const url of bufferPreviewMap.values()) {
      try { URL.revokeObjectURL(url); } catch { }
    }
    bufferPreviewMap.clear();
  } catch { }
});

const addMember = async () => {
  if (!modalName.value.trim()) return;
  adding.value = true;
  const newMember: MemberDto = {
    id: "",
    name: modalName.value,
    rank: modalRank.value,
    photoAssetId: photoAssetId.value || undefined
  };
  try {
    let previewBlob: Blob | undefined;
    if (tempAsset.value) {
      const updated = await assetDataService.addAssetData([tempAsset.value]);
      newMember.photoAssetId = updated[0].id;
      previewBlob = tempAsset.value.blob;
      tempAsset.value = null;
    }
    const addedMember = await memberService.saveMember(newMember);
    if (previewBlob) {
      try { (addedMember as any).photoDataUrl = URL.createObjectURL(previewBlob); } catch { (addedMember as any).photoDataUrl = ''; }
    }
    members.value.push(addedMember);
    await saveMembersToLocalJson();
  } catch (error) {
    console.error("Failed to add member:", error);
  } finally {
    adding.value = false;
  }
};

const onAssetsSelected = async (ids: string[]) => {
  // if a single asset selected, set it as current photoAssetId for modal
  if (ids && ids.length === 1) {
    photoAssetId.value = ids[0];
  }
  // refresh list
  await fetchAssets();
};

const deleteMember = async (id: string) => {
  deleting.value = true;
  deleteMessage.value = "メンバーを削除しています...";
  try {
    await memberService.deleteMember(id);
    await fetchMembers();
    await saveMembersToLocalJson();
  } catch (error) {
    console.error("Failed to delete member:", error);
  } finally {
    deleting.value = false;
  }
};

// multi-add buffer actions
const addBufferRow = () => {
  addBuffer.value.push({ name: '', rank: members.value.length + addBuffer.value.length + 1, photoAsset: null, photoMode: 'upload', photoAssetId: '' });
  // auto-select the newly added row
  selectedBufferIndex.value = addBuffer.value.length - 1;
};

const removeBuffer = (idx: number) => {
  const url = bufferPreviewMap.get(idx);
  if (url) {
    try { URL.revokeObjectURL(url); } catch { }
    bufferPreviewMap.delete(idx);
  }
  addBuffer.value.splice(idx, 1);
  // reindex bufferPreviewMap
  const newMap = new Map<number, string>();
  for (let i = 0; i < addBuffer.value.length; i++) {
    const existing = bufferPreviewMap.get(i >= idx ? i + 1 : i);
    if (existing) newMap.set(i, existing);
  }
  bufferPreviewMap.clear();
  for (const [k, v] of newMap) bufferPreviewMap.set(k, v);
  // adjust selected index
  if (selectedBufferIndex.value !== null) {
    if (selectedBufferIndex.value === idx) {
      selectedBufferIndex.value = null;
    } else if (selectedBufferIndex.value > idx) {
      selectedBufferIndex.value = selectedBufferIndex.value - 1;
    }
  }
};

const clearBuffer = () => {
  addBuffer.value = [];
  selectedBufferIndex.value = null;
};

const bulkSaveMembers = async () => {
  if (!addBuffer.value.length) return;
  adding.value = true;
  try {
    for (const b of addBuffer.value) {
      let photoId: string | undefined = undefined;
      if (b.photoAsset) {
        try {
          const uploaded = await assetDataService.addAssetData([b.photoAsset]);
          if (uploaded && uploaded[0] && uploaded[0].id) photoId = uploaded[0].id;
        } catch (e) {
          console.error('Failed to upload buffered photo:', e);
        }
      } else if (b.photoAssetId) {
        photoId = b.photoAssetId;
      }
      const dto = {
        id: '',
        name: b.name,
        rank: b.rank,
        photoAssetId: photoId,
      } as any;
      const saved = await memberService.saveMember(dto);
      // if we had a blob preview for this buffer, ensure member preview exists
      if (b.photoAsset && saved) {
        try { (saved as any).photoDataUrl = URL.createObjectURL(b.photoAsset.blob); } catch { }
      }
      members.value.push(saved);
    }
    // clear buffer and persist
    addBuffer.value = [];
    selectedBufferIndex.value = null;
    await saveMembersToLocalJson();
  } catch (e) {
    console.error('Failed to bulk save members', e);
  } finally {
    adding.value = false;
  }
  // cleanup previews
  for (const url of bufferPreviewMap.values()) {
    try { URL.revokeObjectURL(url); } catch { }
  }
  bufferPreviewMap.clear();
};

// member sync modal (mirrors admin-assets flow)
const showMemberSyncModal = ref(false);
const showReplaceWarningModal = ref(false);
const pendingSyncMode = ref<'local' | 'drive' | null>(null);

const openMemberSyncModal = () => {
  showMemberSyncModal.value = true;
};

const confirmMemberSyncMode = async (mode: 'local' | 'drive') => {
  // Close the initial mode selection modal
  showMemberSyncModal.value = false;
  if (mode === 'local') {
    // Immediately upload local JSON to Drive
    syncing.value = true;
    syncMessage.value = '';
    try {
      await uploadMembersJsonToDrive();
    } catch (e) {
      console.error('Member sync (local->drive) failed', e);
    } finally {
      syncing.value = false;
      syncMessage.value = '';
    }
  } else {
    // Drive chosen: show replace warning modal before performing replace
    pendingSyncMode.value = 'drive';
    showReplaceWarningModal.value = true;
  }
};

const performReplaceFromDrive = async () => {
  // User confirmed replace from Drive
  showReplaceWarningModal.value = false;
  if (pendingSyncMode.value !== 'drive') return;
  pendingSyncMode.value = null;
  syncing.value = true;
  syncMessage.value = '';
  try {
    await downloadMembersJsonFromDrive();
    await fetchMembers();
  } catch (e) {
    console.error('Failed to replace members from Drive', e);
  } finally {
    syncing.value = false;
    syncMessage.value = '';
  }
};

const deleteSelectedMembers = async () => {
  if (!selectedMembers.value.length) return;
  deleting.value = true;
  deleteMessage.value = "メンバーを削除しています...";
  try {
    await memberService.deleteMembers(selectedMembers.value);
    await fetchMembers();
    selectedMembers.value = [];
    await saveMembersToLocalJson();
  } catch (error) {
    console.error("Failed to delete members:", error);
  } finally {
    deleting.value = false;
  }
};

// local JSON export/import
const STORAGE_KEY = 'jackpot-game-members-json';

const saveMembersToLocalJson = async () => {
  try {
    const payload = JSON.stringify(members.value || []);
    localStorage.setItem(STORAGE_KEY, payload);
  } catch (e) {
    console.error('Failed to save members JSON to localStorage', e);
  }
};

// (removed unused) loadMembersFromLocalJson — persisted members are managed via memberRepo.getMembers

// upload to Google Drive via GAS
const uploadMembersJsonToDrive = async () => {
  try {
    const json = localStorage.getItem(STORAGE_KEY) || JSON.stringify(members.value || []);
    const service = new GasFunctionService('addJson');
    const driveJson = {
      metadata: {
        driveDataId: 'members-json-' + Date.now(),
        fileId: '',
        parentFolderId: '',
        lastUpdate: new Date().toISOString(),
        size: json.length,
      },
      fileName: 'members.json',
      jsonText: json,
      uploadDate: new Date().toISOString(),
      parentFolderId: '',
    };

    const res = await service.call<any>(driveJson);
    // server returns DriveMetadata in response (data) when successful
    const fileId = res?.fileId || res?.data?.fileId || res?.fileId || res?.fileId;
    if (fileId) {
      localStorage.setItem('jackpot-members-last-file-id', fileId);
      console.log('Uploaded members.json fileId=', fileId);
    }
  } catch (e) {
    console.error('Failed to upload members JSON via GAS', e);
  }
};

// fetch members JSON from Drive via GAS
const downloadMembersJsonFromDrive = async () => {
  try {
    const lastId = localStorage.getItem('jackpot-members-last-file-id');
    if (!lastId) {
      console.warn('No last uploaded file id saved');
      return;
    }
    const service = new GasFunctionService('getJson');
    const resp = await service.call<{ json: string } | null>(lastId);
    if (resp && resp.json) {
      const json = resp.json;
      localStorage.setItem(STORAGE_KEY, json);
      try {
        const parsed = JSON.parse(json || '[]');
        if (Array.isArray(parsed)) {
          // persist into memberRepo (localForage) so other processes/refresh see it
          try {
            await memberRepo.replaceAllMembers(parsed as any);
          } catch (e) {
            console.error('Failed to persist members into local repo:', e);
          }
          // refresh UI from repo
          await fetchMembers();
        } else {
          console.warn('Downloaded members JSON is not an array');
        }
      } catch (e) {
        console.error('Failed to parse downloaded members JSON', e);
      }
    }
  } catch (e) {
    console.error('Failed to download members JSON via GAS', e);
  }
};

const fetchMembers = async () => {
  try {
    const fetchedMembers = await memberRepo.getMembers();
    for (const member of fetchedMembers) {
      if (member.photoAssetId) {
        const asset = await assetDataService.getAssetDataById(member.photoAssetId);
        if (asset && asset.id) {
          try { objectUrlMap.set(member.photoAssetId, URL.createObjectURL(asset.blob)); } catch { }
        }
      }
    }
    members.value = fetchedMembers;
    await saveMembersToLocalJson();
  } catch (error) {
    console.error("Failed to fetch members:", error);
    members.value = [];
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

onMounted(async () => {
  await fetchMembers();
  await fetchAssets();
});

watch(photoAssetId, async () => {
  await updateModalPhotoPreview();
});

watch(modalPhotoMode, () => {
  if (modalPhotoMode.value === 'select') {
    tempAsset.value = null;
  }
});
</script>

<style scoped>
.admin-section {
  margin-bottom: 32px;
}

/* two-column helper for small groups like name + rank */
.two-col {
  display: grid;
  grid-template-columns: 1fr 140px;
  gap: 12px;
  align-items: end;
}

@media (max-width: 640px) {
  .two-col {
    grid-template-columns: 1fr;
  }
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

.member-preview {
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

.member-info {
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

.photo-mode {
  display: flex;
  gap: 16px;
}

.photo-mode label {
  display: flex;
  align-items: center;
  gap: 8px;
  color: #fff;
}

.member-input-group {
  display: flex;
  gap: 12px;
  align-items: center;
  flex-wrap: wrap;
}

.member-name-input {
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

/* hide overlay native scrollbar by default (avoid visible vertical bar on open) */
.modal-overlay {
  -ms-overflow-style: none;
  /* IE/Edge */
  scrollbar-width: none;
  /* Firefox */
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

/* Wide modal class (applied only to large add/edit dialogs) */
.modal-content.wide-modal {
  width: 70vw;
  max-width: none;
  flex: 0 0 70vw;
  margin: 0 auto;
  /* constrain height and allow internal scrolling */
  height: 60vh;
  display: flex;
  flex-direction: column;
}

.add-modal-grid {
  display: grid;
  /* left: buffer list, right: form (which contains preview) */
  grid-template-columns: 260px 1fr;
  gap: 18px;
  align-items: stretch;
  /* allow columns to stretch full height */
  margin-top: 12px;
  width: 100%;
  /* allow the grid to expand and scroll inside the modal */
  flex: 1 1 auto;
  min-height: 0;
  /* children columns scroll independently; grid itself shouldn't scroll */
}

/* Right column (form) should be the primary scroll container inside the modal. */
.add-form-column {
  /* allow the form column to scroll independently */
  overflow: auto;
  min-height: 0;
  /* reserve scrollbar gutter where supported and provide a small right padding fallback */
  scrollbar-gutter: stable both-edges;
  --scrollbar-reserve: 16px;
  padding-right: var(--scrollbar-reserve);
  box-sizing: border-box;
  /* make the scrollbar visible but thin */
  scrollbar-width: thin;
  -ms-overflow-style: auto;
}

/* WebKit (Chrome, Safari) */
.add-form-column::-webkit-scrollbar {
  width: 10px;
}

.add-form-column::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.06);
  border-radius: 6px;
}

.buffer-column {
  display: flex;
  flex-direction: column;
  gap: 12px;
  /* make the buffer column stretch to available height so actions can sit at bottom */
  min-height: 0;
  /* allow flex children to shrink */
  height: 100%;
}

.buffer-list {
  background: #1f262b;
  border-radius: 6px;
  padding: 8px;
  overflow: auto;
  border: 1px solid rgba(68, 68, 68, 0.8);
}

.buffer-list {
  /* ensure the list can grow and scroll within the column */
  flex: 1 1 auto;
  min-height: 0;
}

.buffer-list {
  /* let the buffer list grow to fill available column height */
  flex: 1 1 auto;
}

.buffer-actions {
  /* push actions to bottom of the buffer column */
  margin-top: auto;
  display: flex;
  gap: 8px;
}

.buffer-list {
  /* let the buffer list grow to fill available column height */
  flex: 1 1 auto;
}

.buffer-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px;
  border-radius: 6px;
  margin-bottom: 6px;
  cursor: pointer;
}

.buffer-item.active {
  background: linear-gradient(90deg, rgba(79, 140, 255, 0.12), rgba(174, 225, 255, 0.04));
}

.buffer-name {
  color: #dfefff;
  font-weight: 600;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
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

.photo-mode.vertical {
  flex-direction: column;
  gap: 8px;
}

.preview-box {
  width: 100%;
  max-width: 320px;
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

.cancel-primary {
  background: #3b4650;
  color: #fff;
}

.modal-footer {
  grid-column: 1 / -1;
  display: flex;
  justify-content: flex-end;
  margin-top: 18px;
  /* ensure footer stays visible at bottom */
  flex: 0 0 auto;
  /* ensure modal-footer does not overlap the grid content */
  z-index: 2;
}

.modal-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
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
