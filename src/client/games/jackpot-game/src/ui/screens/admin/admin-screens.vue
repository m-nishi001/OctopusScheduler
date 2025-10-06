<template>
  <div class="admin-section">
    <h2>画面設定</h2>
    <div class="tabs">
      <button v-for="tab in tabs" :key="tab.key" :class="['tab-button', { active: activeTab === tab.key }]"
        @click="activeTab = tab.key">
        {{ tab.label }}
      </button>
    </div>
    <div class="tab-content">
      <HomeScreenConfig v-if="activeTab === 'home'" :audio-assets="audioAssets" :asset-service="assetService"
        :config="homeConfig" @update="updateHomeConfig" @uploading="onUploading" />
      <OpeningScreenConfig v-if="activeTab === 'opening'" :audio-assets="audioAssets" :image-assets="imageAssets"
        :asset-service="assetService" :config="openingConfig" @update="updateOpeningConfig" @uploading="onUploading" />
      <DescriptionScreenConfig v-if="activeTab === 'description'" :audio-assets="audioAssets"
        :image-assets="imageAssets" :asset-service="assetService" :config="descriptionConfig"
        @update="updateDescriptionConfig" @uploading="onUploading" />
      <DemoScreenConfig v-if="activeTab === 'demo'" :audio-assets="audioAssets" :members="members" :prizes="prizes"
        :asset-service="assetService" :config="demoConfig" @update="updateDemoConfig" />
      <MainScreenConfig v-if="activeTab === 'main'" :audio-assets="audioAssets" :asset-service="assetService"
        :config="mainConfig" @update="updateMainConfig" />
      <ResultScreenConfig v-if="activeTab === 'result'" :audio-assets="audioAssets" :asset-service="assetService"
        :config="resultConfig" @update="updateResultConfig" />
    </div>
    <div style="display:flex;align-items:center;gap:12px;">
      <button class="admin-btn mt-4" @click="handleSave" :disabled="saving || uploading || loading"
        :style="{ opacity: saving ? 0.6 : 1 }">保存</button>
      <div style="color:#fff;font-size:0.9rem;">{{ saveStatus }}</div>
    </div>
    <!-- ロードモーダル -->
    <div v-if="loading" class="modal-overlay">
      <div class="modal-content">
        <h3>{{ loadingStatus || 'データを読み込み中...' }}</h3>
        <p>アセット、メンバー、景品、画面設定を読み込んでいます。しばらくお待ちください。</p>
        <div class="spinner"></div>
      </div>
    </div>
    <!-- 保存モーダル -->
    <div v-if="saving" class="modal-overlay">
      <div class="modal-content">
        <h3>保存中...</h3>
        <p>{{ saveStatus }}</p>
        <div class="spinner"></div>
      </div>
    </div>
    <!-- アップロードモーダル -->
    <div v-if="uploading" class="modal-overlay">
      <div class="modal-content">
        <h3>アセットをアップロード中...</h3>
        <p>ファイルをアップロードしています。しばらくお待ちください。</p>
        <div class="spinner"></div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import HomeScreenConfig from './screen-config/home-screen-config.vue';
import OpeningScreenConfig from './screen-config/opening-screen-config.vue';
import DescriptionScreenConfig from './screen-config/description-screen-config.vue';
import DemoScreenConfig from './screen-config/demo-screen-config.vue';
import MainScreenConfig from './screen-config/main-screen-config.vue';
import ResultScreenConfig from './screen-config/result-screen-config.vue';
import { useAdminScreens } from '../../composables/admin/use-admin-screens';

const {
  activeTab,
  tabs,
  audioAssets,
  imageAssets,
  homeConfig,
  openingConfig,
  descriptionConfig,
  demoConfig,
  mainConfig,
  resultConfig,
  members,
  prizes,
  onUploading,
  handleSave,
  saving,
  saveStatus,
  uploading,
  loading,
  loadingStatus,
  updateHomeConfig,
  updateOpeningConfig,
  updateDescriptionConfig,
  updateDemoConfig,
  updateMainConfig,
  updateResultConfig,
  assetService,
} = useAdminScreens();
</script>

<style scoped>
.admin-section {
  margin-bottom: 32px;
}

.tabs {
  display: flex;
  gap: 8px;
  margin-bottom: 24px;
  border-bottom: 1px solid #555;
}

.tab-button {
  padding: 12px 24px;
  border: none;
  background: #333;
  color: #ccc;
  cursor: pointer;
  border-radius: 8px 8px 0 0;
  transition: background 0.2s, color 0.2s;
}

.tab-button.active {
  background: #4f8cff;
  color: #fff;
}

.tab-content {
  padding: 24px;
  background: #232b36;
  border-radius: 8px;
}

.screen-config {
  margin-bottom: 24px;
}

.screen-config h3 {
  margin-bottom: 16px;
  color: #fff;
}

.config-item {
  margin-bottom: 24px;
}

.config-item label {
  display: block;
  margin-bottom: 8px;
  font-weight: bold;
  color: #fff;
}

.content-item,
.slide-item {
  border: 1px solid #555;
  padding: 16px;
  margin-bottom: 16px;
  border-radius: 8px;
  background: #333;
}

.admin-input {
  padding: 10px 16px;
  border-radius: 8px;
  border: none;
  background: #232b36;
  color: #fff;
  font-size: 1rem;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.08);
  margin-bottom: 8px;
  width: 100%;
}

.admin-input:focus {
  outline: 2px solid #4f8cff;
}

.admin-btn {
  padding: 10px 24px;
  border-radius: 8px;
  border: none;
  background: linear-gradient(90deg, #4f8cff 0%, #aee1ff 100%);
  color: #232b36;
  font-weight: bold;
  cursor: pointer;
  transition: background 0.2s;
}

.admin-btn:hover {
  background: linear-gradient(90deg, #aee1ff 0%, #4f8cff 100%);
}

.asset-mode {
  display: flex;
  gap: 16px;
  margin-bottom: 16px;
}

.asset-mode label {
  display: flex;
  align-items: center;
  gap: 8px;
  color: #fff;
}

textarea.admin-input {
  resize: vertical;
  min-height: 100px;
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
  text-align: center;
  box-shadow: 0 6px 28px rgba(0, 0, 0, 0.36);
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
