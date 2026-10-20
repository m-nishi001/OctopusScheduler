<template>
  <div class="prize-form">
    <div class="form-grid">
      <div class="basic-fields">
        <div class="name-field">
          <FieldText v-model="formData.name" label="名前" placeholder="景品名" />
        </div>
        <div class="weight-field">
          <FieldNumberStepper v-model="formData.weight" :min="1" :max="100" label="当選確率の重み" />
          <p class="odds-preview">このプールでの当選確率: 約{{ oddsPreviewPercent }}%</p>
        </div>
        <div class="animation-field">
          <FieldSelect v-model="formData.animation" :options="animationOptions" label="抽選アニメーション" />
        </div>
      </div>

      <div v-for="slot in IMAGE_SLOTS" :key="slot.field" :class="slot.area">
        <ImageField :label="slot.label" v-model:mode="slotState[slot.field].mode" v-model:assetId="formData[slot.field]"
          :filename="slotState[slot.field].filename" :preview="previewOf(slot)" :assets="imageAssets"
          @file-change="onFileChange(slot, $event)" />
      </div>

      <div class="bgm-actions">
        <BgmField v-for="slot in BGM_SLOTS" :key="slot.field" :label="slot.label" v-model:mode="slotState[slot.field].mode"
          v-model:assetId="formData[slot.field]" :filename="slotState[slot.field].filename" :assets="audioAssets"
          @file-change="onFileChange(slot, $event)" />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, watch } from 'vue';
import FieldText from '../../../ui/pages/admin/prizes/components/field-text.vue';
import FieldNumberStepper from '../../../ui/pages/admin/prizes/components/field-number-stepper.vue';
import FieldSelect from '../../../ui/pages/admin/prizes/components/field-select.vue';
import ImageField from '../../../ui/pages/admin/prizes/components/image-field.vue';
import BgmField from '../../../ui/pages/admin/prizes/components/bgm-field.vue';
import { useObjectUrlStore } from '@ui/composables/use-object-url-store';
import { useAssetUpload } from '@ui/composables/use-asset-upload';
import { container } from 'tsyringe';
import { AssetDataService } from '@control/asset/asset-data-service';
import type { Asset } from '@model/asset/asset-data';
import type { Prize } from '@model/prize/prize';
import { DEFAULT_WEIGHT, resolveWeight } from '@model/draw/weighted-selector';
import {
  BGM_SLOTS,
  IMAGE_SLOTS,
  PRIZE_ASSET_SLOTS,
  initialSlotMode,
  slotModeFor,
  type PrizeAssetField,
  type PrizeAssetSlot,
  type SlotMode,
} from './prize-asset-slots';

const props = defineProps({
  mode: { type: String as () => 'add' | 'edit', required: true },
  prize: { type: Object, default: null },
  imageAssets: { type: Array as () => Asset[], required: true },
  audioAssets: { type: Array as () => Asset[], required: true },
  objectUrlMap: { type: Object as () => Map<string, string> | undefined, required: false },
  /** 当選確率プレビュー計算のための、このプール内の他の景品(編集中の景品自身は除く)。 */
  otherPrizes: { type: Array as () => Prize[], default: () => [] },
});

const emit = defineEmits(['submit', 'cancel']);

// 親から渡された objectUrlMap があればそれを、無ければこのフォームの中だけのものを使う。
const localStore = useObjectUrlStore();
const getMap = () => props.objectUrlMap ?? localStore.objectUrlMap;

function createObjUrl(file: File | Blob, id: string): void {
  if (props.objectUrlMap) {
    try { props.objectUrlMap.set(id, URL.createObjectURL(file)); } catch { }
    return;
  }
  localStore.createObjectUrl(file, id);
}

function revokeObj(id: string): void {
  if (props.objectUrlMap) {
    const url = props.objectUrlMap.get(id);
    if (url) {
      try { URL.revokeObjectURL(url); } catch { }
      try { props.objectUrlMap.delete(id); } catch { }
    }
    return;
  }
  localStore.revoke(id);
}
const { uploadAsset } = useAssetUpload();
const assetDataService = container.resolve(AssetDataService);

const animationOptions = [
  { value: 'roulette', label: 'ルーレット' },
  { value: 'slot', label: 'スロット' },
];

type FormData = { name: string; weight: number; animation: string } & Record<PrizeAssetField, string>;

const emptyFormData = (): FormData => ({
  name: '',
  weight: DEFAULT_WEIGHT,
  animation: 'roulette',
  imageAssetId: '',
  image2AssetId: '',
  bgm1AssetId: '',
  bgm2AssetId: '',
  winningImage1AssetId: '',
  winningImage2AssetId: '',
});
const formData = ref<FormData>(emptyFormData());

/** 素材欄ごとの状態。選び方・選んだファイル名・まだ保存していない(アップロード前の)素材。 */
interface SlotState { mode: SlotMode; filename: string; temp: Asset | null }
const slotState = reactive(
  Object.fromEntries(PRIZE_ASSET_SLOTS.map((s) => [s.field, { mode: initialSlotMode(s), filename: '', temp: null } as SlotState]))
) as Record<PrizeAssetField, SlotState>;

/** プレビューの URL。選んだだけの画像 → 登録済みの素材の URL → 素材の id そのもの、の順。 */
function previewOf(slot: PrizeAssetSlot): string {
  const map = getMap();
  const id = formData.value[slot.field];
  return (slot.previewKey ? map.get(slot.previewKey) : undefined) || (id ? map.get(id) : undefined) || id;
}

async function onFileChange(slot: PrizeAssetSlot, e: Event) {
  const file = (e.target as HTMLInputElement).files?.[0];
  if (!file) return;
  const state = slotState[slot.field];
  state.temp = await assetDataService.createDriveDataDtoFromFile(file);
  state.filename = file.name;
  if (slot.previewKey) {
    revokeObj(slot.previewKey);
    createObjUrl(file, slot.previewKey);
  }
}

const isValid = computed(() => formData.value.name.trim());

// このプール内の他の景品(編集中の景品自身を除く)に対する当選確率のプレビュー。
const oddsPreviewPercent = computed(() => {
  const currentId = props.mode === 'edit' && props.prize ? props.prize.id : undefined;
  const othersTotalWeight = props.otherPrizes
    .filter((p) => p.id !== currentId)
    .reduce((sum, p) => sum + resolveWeight(p.weight), 0);
  const currentWeight = resolveWeight(formData.value.weight);
  const totalWeight = othersTotalWeight + currentWeight;
  if (totalWeight <= 0) return '0.0';
  return ((currentWeight / totalWeight) * 100).toFixed(1);
});

// 親のダイアログのフッターのボタンから呼べるようにする
defineExpose({ submit, cancel });

watch(() => props.prize, (val) => {
  if (val && props.mode === 'edit') loadPrize(val);
}, { immediate: true });

function loadPrize(prize: any) {
  formData.value = {
    ...emptyFormData(),
    name: prize.name,
    weight: prize.weight ?? DEFAULT_WEIGHT,
    animation: prize.animation || 'roulette',
    ...Object.fromEntries(PRIZE_ASSET_SLOTS.map((s) => [s.field, prize[s.field] || ''])),
  };
  for (const slot of PRIZE_ASSET_SLOTS) slotState[slot.field].mode = slotModeFor(prize, slot);
}

async function submit() {
  if (!isValid.value) return;

  try {
    // 選んだだけの素材を、まとめてアップロードして id を入れる
    const pending = PRIZE_ASSET_SLOTS.filter((s) => slotState[s.field].temp);
    const uploaded = await Promise.all(pending.map(async (s) => ({ slot: s, result: await uploadAsset(slotState[s.field].temp!) })));
    for (const { slot, result } of uploaded) formData.value[slot.field] = (result as { assetId: string }).assetId;

    // 一時的なプレビュー URL と、アップロード済みの素材を片付ける
    for (const slot of PRIZE_ASSET_SLOTS) {
      if (slot.previewKey) revokeObj(slot.previewKey);
      slotState[slot.field].temp = null;
    }

    emit('submit', formData.value);
  } catch (error) {
    console.error('Failed to upload assets:', error);
  }
}

function cancel() {
  emit('cancel');
}
</script>

<style scoped>
.prize-form {
  overflow-x: hidden;
  /* Let the dialog's scrolling container handle vertical scrolling to avoid nested scrollbars */
  overflow-y: visible;
  box-sizing: border-box;
  padding-bottom: 40px;
}


.form-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  /* 5 rows: basic-fields / animation (handled inside basic) / images / winning images / bgm */
  grid-template-rows: auto auto auto auto auto;
  gap: 20px;
  padding: 20px;
  min-width: 0;
  min-height: 0;
}

/* ensure grid can shrink and children don't force overflow */
.basic-fields,
.image1-preview,
.image2-section,
.winning-image1-section,
.winning-image2-section,
.bgm-actions {
  min-width: 0;
}

.basic-fields {
  grid-column: 1 / -1;
  grid-row: 1;
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
  align-items: start;
}

.basic-fields>.name-field {
  grid-column: 1;
}

.basic-fields>.weight-field {
  grid-column: 2;
}

.odds-preview {
  margin: 4px 0 0;
  font-size: 0.85em;
  color: #666;
}

.basic-fields>.animation-field {
  grid-column: 1 / -1;
  margin-top: 8px;
}

.image1-preview {
  grid-column: 1;
  grid-row: 3;
}

.image2-section {
  grid-column: 2;
  grid-row: 3;
}

.winning-image1-section {
  grid-column: 1;
  grid-row: 4;
}

.winning-image2-section {
  grid-column: 2;
  grid-row: 4;
}

.bgm-actions {
  grid-column: 1 / -1;
  grid-row: 5;
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}

.preview-box {
  width: 100%;
  max-width: 220px;
  aspect-ratio: 1 / 1;
  border: 1px solid #ccc;
  display: flex;
  align-items: center;
  justify-content: center;
}

.preview-box img {
  max-width: 100%;
  max-height: 100%;
  object-fit: contain;
}

.placeholder {
  color: #999;
}

.actions {
  display: flex;
  gap: 10px;
  margin-top: 20px;
}

.bgm-actions>.actions {
  grid-column: 1 / -1;
}

/* sticky footer within the scrolling form */
.actions {
  position: sticky;
  bottom: 0;
  z-index: 20;
  background: linear-gradient(180deg, rgba(0, 0, 0, 0), rgba(0, 0, 0, 0));
  padding-top: 12px;
}

@media (max-width: 768px) {
  .form-grid {
    grid-template-columns: 1fr;
    grid-template-rows: repeat(5, auto);
  }

  .basic-fields {
    grid-template-columns: 1fr;
  }

  .bgm-actions {
    grid-template-columns: 1fr;
  }

  .preview-box {
    max-width: 100%;
  }
}
</style>