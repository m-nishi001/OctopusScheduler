<template>
  <div class="admin-section">
    <h2>画面設定 - {{ screenLabels[activeScreen] }}</h2>
    <div class="tab-content">
      <HomeScreenConfig v-if="activeScreen === 'home'" :audio-assets="audioAssets" :asset-service="assetService"
        :config="homeConfig" @update="updateHomeConfig" @uploading="onUploading" @tempAssets="onTempAssets" />
      <OpeningScreenConfig v-if="activeScreen === 'opening'" :audio-assets="audioAssets" :image-assets="imageAssets"
        :asset-service="assetService" :config="openingConfig" @update="updateOpeningConfig" @uploading="onUploading"
        @tempAssets="onTempAssets" />
      <DescriptionScreenConfig v-if="activeScreen === 'description'" :audio-assets="audioAssets"
        :image-assets="imageAssets" :asset-service="assetService" :config="descriptionConfig"
        @update="updateDescriptionConfig" @uploading="onUploading" @tempAssets="onTempAssets" />
      <DemoScreenConfig v-if="activeScreen === 'demo'" :audio-assets="audioAssets" :members="members" :prizes="prizes"
        :asset-service="assetService" :config="demoConfig" @update="updateDemoConfig" @tempAssets="onTempAssets" />
      <MainScreenConfig v-if="activeScreen === 'main'" :audio-assets="audioAssets" :asset-service="assetService"
        :config="mainConfig" @update="updateMainConfig" @tempAssets="onTempAssets" />
      <ResultScreenConfig v-if="activeScreen === 'result'" :audio-assets="audioAssets" :asset-service="assetService"
        :config="resultConfig" @update="updateResultConfig" @tempAssets="onTempAssets" />
      <EndingScreenConfig v-if="activeScreen === 'ending'" :audio-assets="audioAssets" :image-assets="imageAssets"
        :asset-service="assetService" :config="endingConfig" @update="updateEndingConfig" @uploading="onUploading"
        @tempAssets="onTempAssets" />
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
import { ref, computed, onMounted } from "vue";
import { useRoute } from 'vue-router';
import HomeScreenConfig from './screen-config/home-screen-config.vue';
import OpeningScreenConfig from './screen-config/opening-screen-config.vue';
import DescriptionScreenConfig from './screen-config/description-screen-config.vue';
import DemoScreenConfig from './screen-config/demo-screen-config.vue';
import MainScreenConfig from './screen-config/main-screen-config.vue';
import ResultScreenConfig from './screen-config/result-screen-config.vue';
import EndingScreenConfig from './screen-config/ending-screen-config.vue';
import { container } from "tsyringe";
import type { IScreenConfigRepository } from '../../../model/domains/screen-config/repository/IScreenConfigRepository';
import { AssetService } from '../../../model/applications/asset/asset-service';
import type { IMemberRepository } from '../../../model/domains/member/repository/IMemberRepository';
import type { IPrizeRepository } from '../../../model/domains/prize/repository/IPrizeRepository';
import { AssetDto } from '../../../model/applications/asset/dto/asset-dto';

// Inline asset logic from useAssets composable
const route = useRoute();
const activeScreen = computed(() => route.params.screenType as string || 'home');
const screenLabels: Record<string, string> = {
  home: 'ホーム',
  opening: 'オープニング',
  description: '説明',
  demo: 'デモ抽選',
  main: '本抽選',
  result: '最終結果',
  ending: 'エンディング'
};

const assetService = container.resolve(
  AssetService
) as unknown as AssetService;
const screenConfigRepo = container.resolve<IScreenConfigRepository>("IScreenConfigRepository");
const memberRepo = container.resolve<IMemberRepository>("IMemberRepository");
const prizeRepo = container.resolve<IPrizeRepository>("IPrizeRepository");

const assets = ref<any[]>([]);

const fetchAssets = async () => {
  try {
    assets.value = await assetService.getAllAssets();
  } catch (error) {
    console.error("Failed to fetch assets:", error);
    assets.value = [];
  }
};

const syncWithDrive = async (onMessage?: (msg: string) => void) => {
  try {
    await assetService.syncAssets((message: string) => {
      if (onMessage) onMessage(message);
    });
  } catch (e) {
    console.error("syncAssets failed", e);
  }
};

const audioAssets = computed(() =>
  assets.value.filter((a) => a.type === "audio")
);
const imageAssets = computed(() =>
  assets.value.filter((a) => a.type === "image")
);

// Inline entities logic from useEntities composable
const members = ref<any[]>([]);
const prizes = ref<any[]>([]);

const fetchMembers = async () => {
  try {
    members.value = await memberRepo.getMembers();
  } catch (error) {
    console.error("Failed to fetch members:", error);
    members.value = [];
  }
};

const fetchPrizes = async () => {
  try {
    prizes.value = await prizeRepo.getPrizes();
  } catch (error) {
    console.error("Failed to fetch prizes:", error);
    prizes.value = [];
  }
};

const loading = ref(false);
const loadingStatus = ref("");

const homeConfig = ref<any>({
  id: "",
  bgmMode: "select",
  bgmAssetId: "",
  buttonSeMode: "select",
  buttonSeAssetId: "",
  progressSeMode: "select",
  progressSeAssetId: "",
});
const openingConfig = ref<any>({
  id: "",
  bgmMode: "select",
  bgmAssetId: "",
  displayMode: "list",
  contents: [],
});
const descriptionConfig = ref<any>({ id: "", slides: [] });
const demoConfig = ref<any>({
  id: "",
  winnerMemberId: "",
  winnerPrizeId: "",
  bgmMode: "select",
  bgmAssetId: "",
  seMode: "select",
  seAssetId: "",
});
const mainConfig = ref<any>({
  id: "",
  bgmMode: "select",
  bgmAssetId: "",
  memberSeMode: "select",
  memberSeAssetId: "",
  prizeStartSeMode: "select",
  prizeStartSeAssetId: "",
  lotterySeMode: "select",
  lotterySeAssetId: "",
  confirmSeMode: "select",
  confirmSeAssetId: "",
  winnerSeMode: "select",
  winnerSeAssetId: "",
  nextSeMode: "select",
  nextSeAssetId: "",
  halfSeMode: "select",
  halfSeAssetId: "",
  endSeMode: "select",
  endSeAssetId: "",
});
const resultConfig = ref<any>({
  id: "",
  bgmMode: "select",
  bgmAssetId: "",
  scrollSeMode: "select",
  scrollSeAssetId: "",
  highSeMode: "select",
  highSeAssetId: "",
  lowSeMode: "select",
  lowSeAssetId: "",
  fadeSeMode: "select",
  fadeSeAssetId: "",
});
const endingConfig = ref<any>({
  id: "",
  bgmMode: "select",
  bgmAssetId: "",
  displayMode: "list",
  contents: [],
});

const loadScreenConfigs = async () => {
  try {
    loadingStatus.value = "画面設定を読み込み中...";
    const screenTypes = [
      "home",
      "opening",
      "description",
      "demo",
      "main",
      "result",
      "ending",
    ];
    // For admin UI we want the raw stored config (placeholders like {asset:ID} preserved)
    const results = await Promise.all(
      screenTypes.map((type) =>
        screenConfigRepo.getScreenConfigById(type)
      )
    );

    results.forEach((config: any, idx: number) => {
      const type = screenTypes[idx];
      if (!config) return;
      if (type === "home") {
        homeConfig.value = {
          id: config.id || "",
          bgmMode: config.bgmAssetId ? "select" : "select",
          bgmAssetId: config.bgmAssetId || "",
          buttonSeMode: "select",
          buttonSeAssetId: config.seAssetIds?.[0] || "",
          progressSeMode: "select",
          progressSeAssetId: config.seAssetIds?.[1] || "",
        };
      } else if (type === "opening") {
        openingConfig.value = {
          id: config.id || "",
          bgmMode: config.bgmAssetId ? "select" : "select",
          bgmAssetId: config.bgmAssetId || "",
          displayMode: config.displayMode || "list",
          contents: config.elements.map((el: any) => ({
            id: el.id,
            type: el.type,
            text: el.content || "",
            content: el.content || "",
            assetId: el.assetId || "",
            imageMode: "select",
            seMode: "select",
            effect: el.animation?.type || "fade",
            duration: el.animation?.duration || 1000,
            scrollDirection: el.animation?.scrollDirection || "up",
            seAssetId: "",
          })),
        };
      } else if (type === "description") {
        descriptionConfig.value = {
          id: config.id || "",
          slides: config.elements.map((el: any, idx2: number) => ({
            id: el.id,
            html: el.content || "",
            imageAssetId: el.assetId || "",
            imageMode: el.assetId ? "select" : "select",
            effect: el.animation?.type || "fade",
            duration: el.animation?.duration || 1000,
            bgmAssetId: (config.seAssetIds && config.seAssetIds[idx2]) || "",
            bgmMode:
              config.seAssetIds && config.seAssetIds[idx2]
                ? "select"
                : "select",
          })),
        };
      } else if (type === "demo") {
        demoConfig.value = {
          id: config.id || "",
          winnerMemberId: "",
          winnerPrizeId: "",
          bgmMode: config.bgmAssetId ? "select" : "select",
          bgmAssetId: config.bgmAssetId || "",
          seMode: "select",
          seAssetId: config.seAssetIds?.[0] || "",
        };
      } else if (type === "main") {
        mainConfig.value = {
          id: config.id || "",
          bgmMode: config.bgmAssetId ? "select" : "select",
          bgmAssetId: config.bgmAssetId || "",
          memberSeMode: "select",
          memberSeAssetId: config.seAssetIds?.[0] || "",
          prizeStartSeMode: "select",
          prizeStartSeAssetId: config.seAssetIds?.[1] || "",
          lotterySeMode: "select",
          lotterySeAssetId: config.seAssetIds?.[2] || "",
          confirmSeMode: "select",
          confirmSeAssetId: config.seAssetIds?.[3] || "",
          winnerSeMode: "select",
          winnerSeAssetId: config.seAssetIds?.[4] || "",
          nextSeMode: "select",
          nextSeAssetId: config.seAssetIds?.[5] || "",
          halfSeMode: "select",
          halfSeAssetId: config.seAssetIds?.[6] || "",
          endSeMode: "select",
          endSeAssetId: config.seAssetIds?.[7] || "",
        };
      } else if (type === "result") {
        resultConfig.value = {
          id: config.id || "",
          bgmMode: "select",
          bgmAssetId: config.bgmAssetId || "",
          scrollSeMode: "select",
          scrollSeAssetId: config.seAssetIds?.[0] || "",
          highSeMode: "select",
          highSeAssetId: config.seAssetIds?.[1] || "",
          lowSeMode: "select",
          lowSeAssetId: config.seAssetIds?.[2] || "",
          fadeSeMode: "select",
          fadeSeAssetId: config.seAssetIds?.[3] || "",
        };
      } else if (type === "ending") {
        endingConfig.value = {
          id: config.id || "",
          bgmMode: config.bgmAssetId ? "select" : "select",
          bgmAssetId: config.bgmAssetId || "",
          displayMode: config.displayMode || "list",
          contents: config.elements.map((el: any) => ({
            id: el.id,
            type: el.type,
            text: el.content || "",
            content: el.content || "",
            assetId: el.assetId || "",
            imageMode: "select",
            seMode: "select",
            effect: el.animation?.type || "fade",
            duration: el.animation?.duration || 1000,
            scrollDirection: el.animation?.scrollDirection || "up",
            seAssetId: "",
          })),
        };
      }
    });
  } catch (error) {
    console.error("Failed to load screen configs:", error);
  }
};

const updateHomeConfig = (config: any) => {
  homeConfig.value = config;
};
const updateOpeningConfig = (config: any) => {
  openingConfig.value = config;
};
const updateDescriptionConfig = (config: any) => {
  descriptionConfig.value = config;
};
const updateDemoConfig = (config: any) => {
  demoConfig.value = config;
};
const updateMainConfig = (config: any) => {
  mainConfig.value = config;
};
const updateResultConfig = (config: any) => {
  resultConfig.value = config;
};
const updateEndingConfig = (config: any) => {
  endingConfig.value = config;
};

const saveConfigs = async () => {
  const configs = [
    {
      id: homeConfig.value.id,
      type: "home" as const,
      bgmAssetId: homeConfig.value.bgmAssetId || undefined,
      seAssetIds: [
        homeConfig.value.buttonSeAssetId,
        homeConfig.value.progressSeAssetId,
      ].filter((id: any) => id),
      backgroundStyle: "",
      elements: [],
    },
    {
      id: openingConfig.value.id,
      type: "opening" as const,
      bgmAssetId: openingConfig.value.bgmAssetId || undefined,
      seAssetIds: openingConfig.value.contents.flatMap((c: any) =>
        c.seAssetId ? [c.seAssetId] : []
      ),
      backgroundStyle: "",
      displayMode: openingConfig.value.displayMode || "list",
      elements: openingConfig.value.contents.map((content: any) => ({
        type: content.type as any,
        content:
          content.type === "html"
            ? content.content || content.text
            : content.text,
        assetId: content.assetId,
        animation: {
          type: content.effect as any,
          duration: content.duration,
          scrollDirection: content.scrollDirection,
        },
      })),
    },
    {
      id: descriptionConfig.value.id,
      type: "description" as const,
      bgmAssetId: undefined,
      seAssetIds: descriptionConfig.value.slides.flatMap((s: any) =>
        s.bgmAssetId ? [s.bgmAssetId] : []
      ),
      backgroundStyle: "",
      elements: descriptionConfig.value.slides.map((slide: any) => ({
        type: "text" as const,
        content: slide.html,
        assetId: slide.imageAssetId,
        animation: { type: slide.effect as any, duration: slide.duration },
      })),
    },
    {
      id: demoConfig.value.id,
      type: "demo" as const,
      bgmAssetId: demoConfig.value.bgmAssetId || undefined,
      seAssetIds: demoConfig.value.seAssetId
        ? [demoConfig.value.seAssetId]
        : [],
      backgroundStyle: "",
      elements: [],
    },
    {
      id: mainConfig.value.id,
      type: "main" as const,
      bgmAssetId: mainConfig.value.bgmAssetId || undefined,
      seAssetIds: [
        mainConfig.value.memberSeAssetId,
        mainConfig.value.prizeStartSeAssetId,
        mainConfig.value.lotterySeAssetId,
        mainConfig.value.confirmSeAssetId,
        mainConfig.value.winnerSeAssetId,
        mainConfig.value.nextSeAssetId,
        mainConfig.value.halfSeAssetId,
        mainConfig.value.endSeAssetId,
      ].filter((id: any) => id),
      backgroundStyle: "",
      elements: [],
    },
    {
      id: resultConfig.value.id,
      type: "result" as const,
      bgmAssetId: resultConfig.value.bgmAssetId || undefined,
      seAssetIds: [
        resultConfig.value.scrollSeAssetId,
        resultConfig.value.highSeAssetId,
        resultConfig.value.lowSeAssetId,
        resultConfig.value.fadeSeAssetId,
      ].filter((id: any) => id),
      backgroundStyle: "",
      elements: [],
    },
    {
      id: endingConfig.value.id,
      type: "ending" as const,
      bgmAssetId: endingConfig.value.bgmAssetId || undefined,
      seAssetIds: endingConfig.value.contents.flatMap((c: any) =>
        c.seAssetId ? [c.seAssetId] : []
      ),
      backgroundStyle: "",
      displayMode: endingConfig.value.displayMode || "list",
      elements: endingConfig.value.contents.map((content: any) => ({
        type: content.type as any,
        content:
          content.type === "html"
            ? content.content || content.text
            : content.text,
        assetId: content.assetId,
        animation: {
          type: content.effect as any,
          duration: content.duration,
          scrollDirection: content.scrollDirection,
        },
      })),
    },
  ];

  await screenConfigRepo.updateScreenConfigs(configs as any);
  await loadScreenConfigs();
};

const saving = ref(false);
const saveStatus = ref("");
const uploading = ref(false);
const tempAssets = ref<AssetDto[]>([]);

const onUploading = (isUploading: boolean) => {
  uploading.value = isUploading;
};

const onTempAssets = (newTempAssets: AssetDto[]) => {
  // Merge tempAssets from different components
  const existingIds = tempAssets.value.map(a => a.id);
  newTempAssets.forEach(asset => {
    if (!existingIds.includes(asset.id)) {
      tempAssets.value.push(asset);
    }
  });
};

const handleSave = async () => {
  // provide UI feedback and call underlying saveConfigs
  try {
    saving.value = true;
    saveStatus.value = "保存中...";

    // Upload temp assets first
    if (tempAssets.value.length > 0) {
      saveStatus.value = "アセットをアップロード中...";
      const tempIdMap = new Map<string, AssetDto>();
      tempAssets.value.forEach(asset => {
        tempIdMap.set(asset.id, asset);
      });
      await assetService.addAssets(tempAssets.value);

      // Replace temp IDs with real IDs in configs
      const idMap = new Map<string, string>();
      tempAssets.value.forEach(asset => {
        const tempId = Array.from(tempIdMap.keys()).find(key => tempIdMap.get(key) === asset);
        if (tempId) {
          idMap.set(tempId, asset.id);
        }
      });

      // Replace in all configs
      const replaceTempIds = (obj: any) => {
        for (const key in obj) {
          if (typeof obj[key] === 'string' && obj[key].startsWith('temp_')) {
            if (idMap.has(obj[key])) {
              obj[key] = idMap.get(obj[key]);
            }
          } else if (typeof obj[key] === 'object' && obj[key] !== null) {
            replaceTempIds(obj[key]);
          }
        }
      };

      replaceTempIds(homeConfig.value);
      replaceTempIds(openingConfig.value);
      replaceTempIds(descriptionConfig.value);
      replaceTempIds(demoConfig.value);
      replaceTempIds(mainConfig.value);
      replaceTempIds(resultConfig.value);
      replaceTempIds(endingConfig.value);

      // Clear tempAssets
      tempAssets.value = [];
    }

    await saveConfigs();
    saveStatus.value = "保存しました";
  } catch (err) {
    console.error("Failed to save configs:", err);
    saveStatus.value = "保存に失敗しました";
  } finally {
    saving.value = false;
  }
};

onMounted(async () => {
  loading.value = true;
  loadingStatus.value = "データを読み込み中...";
  try {
    await syncWithDrive((message: string) => {
      loadingStatus.value = message;
    });

    const assetsPromise = fetchAssets();
    const membersPromise = fetchMembers();
    const prizesPromise = fetchPrizes();
    const configsPromise = loadScreenConfigs();

    await Promise.all([
      assetsPromise,
      membersPromise,
      prizesPromise,
      configsPromise,
    ]);
  } finally {
    loading.value = false;
    loadingStatus.value = "";
  }
});
</script>

<style scoped>
.admin-section {
  margin-bottom: 32px;
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
