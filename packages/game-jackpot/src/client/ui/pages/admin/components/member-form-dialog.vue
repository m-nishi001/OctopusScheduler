<template>
  <UiDialog :model-value="true" :title="mode === 'edit' ? 'メンバー詳細' : 'メンバーを追加'" size="lg" nested
    :close-on-overlay="false" confirm-label="保存" :loading="saving" :confirm-disabled="!canSubmit"
    @confirm="submit" @close="$emit('cancel')">

        <div v-if="mode === 'add'" class="form-group">
          <label>登録方法</label>
          <div class="photo-mode">
            <label><input type="radio" v-model="attachMode" value="new" /> 新規作成</label>
            <label>
              <input type="radio" v-model="attachMode" value="existing"
                :disabled="!existingDirectoryMembers.length" /> 共有マスタから選択
            </label>
          </div>
        </div>

        <div v-if="mode === 'add' && attachMode === 'existing'" class="form-group">
          <label>メンバー</label>
          <select v-model="selectedExistingId">
            <option value="">選択してください</option>
            <option v-for="m in existingDirectoryMembers" :key="m.id" :value="m.id">{{ m.name }}</option>
          </select>
        </div>

        <div class="two-col">
          <div class="form-group">
            <label>名前</label>
            <input v-model="name" type="text" placeholder="メンバー名"
              :disabled="mode === 'add' && attachMode === 'existing'" />
          </div>
          <div class="form-group">
            <label>ランク</label>
            <input v-model.number="rank" type="number" placeholder="ランク" min="1" :max="maxRank" step="1"
              />
          </div>
        </div>

        <div class="form-group">
          <label>当選しやすさ（{{ MIN_WEIGHT }}〜{{ MAX_WEIGHT }}）</label>
          <input v-model.number="weight" type="number" :min="MIN_WEIGHT" :max="MAX_WEIGHT" step="1" data-testid="member-weight" />
          <div class="hint">大きいほど当選しやすくなります。全員が同じ値なら、みんな同じ確率です（既定 {{ DEFAULT_WEIGHT }}）。</div>
        </div>

        <p class="hint">顔写真は、設定の「メンバー」(共通の名簿)で設定します。</p>
  </UiDialog>
</template>

<script setup lang="ts">
import { UiDialog } from '@octopus/ui-kit';
import { ref, computed, watch } from 'vue';
import { DEFAULT_WEIGHT, MAX_WEIGHT, MIN_WEIGHT, resolveWeight } from '@model/draw/weighted-selector';
import type { Member as DirectoryMember } from '@octopus/accounts';
import type { MemberFormInput } from '../use-members';

const props = defineProps({
  mode: { type: String as () => 'add' | 'edit', required: true },
  member: { type: Object, default: null },
  existingDirectoryMembers: { type: Array as () => DirectoryMember[], default: () => [] },
});

const emit = defineEmits<{
  submit: [input: MemberFormInput];
  cancel: [];
}>();

const name = ref('');
const rank = ref(1);
const maxRank = ref(10);
const weight = ref<number>(DEFAULT_WEIGHT);
const saving = ref(false);
const attachMode = ref<'new' | 'existing'>('new');
const selectedExistingId = ref('');

watch(attachMode, (value) => {
  if (value === 'new') {
    selectedExistingId.value = '';
    name.value = '';
  }
});

watch(selectedExistingId, (id) => {
  const found = props.existingDirectoryMembers.find((m) => m.id === id);
  name.value = found ? found.name : '';
});

const canSubmit = computed(() => {
  if (rank.value < 1 || saving.value) return false;
  if (!Number.isInteger(weight.value) || weight.value < MIN_WEIGHT || weight.value > MAX_WEIGHT) return false;
  if (props.mode === 'add' && attachMode.value === 'existing') {
    return !!selectedExistingId.value;
  }
  return !!name.value.trim();
});

const loadFromMember = (member: any) => {
  name.value = member.name;
  rank.value = member.rank;
  weight.value = resolveWeight(member.weight);
  maxRank.value = 10;
};

if (props.mode === 'edit' && props.member) {
  loadFromMember(props.member);
} else {
  rank.value = 5;
}

const submit = async () => {
  if (!canSubmit.value) return;
  saving.value = true;
  try {
    emit('submit', {
      id: props.mode === 'add' && attachMode.value === 'existing' ? selectedExistingId.value : undefined,
      name: name.value,
      rank: rank.value,
      weight: weight.value,
    });
  } finally {
    saving.value = false;
  }
};

</script>

<style scoped>
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
</style>
