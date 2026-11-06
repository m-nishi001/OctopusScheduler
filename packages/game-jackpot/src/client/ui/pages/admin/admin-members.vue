<template>
  <div class="admin-section">
    <UiToolbar>
      <UiButton variant="primary" icon="add" @click.prevent="openModal('add')">追加</UiButton>
      <UiButton v-if="selectedMembers.length" variant="danger" icon="restore" :loading="deleting" @click="resetSelected">
        選択の設定を初期値に戻す({{ selectedMembers.length }})
      </UiButton>
      <TableIoToolbar :count="members.length" :on-export="memberIo.onExport" media-label="写真も含める(ZIP)"
        @import="importOpen = true" />
    </UiToolbar>

    <MemberList :members="members" v-model:selected="selectedMembers" :get-member-image-src="getMemberImageSrc"
      @edit="(member) => openModal('edit', member)" @delete="resetOne" />
  </div>

  <TableImportDialog v-model="importOpen" :on-preview="memberIo.onPreviewImport" media-label="写真フォルダ"
    media-hint="CSVの写真の列のファイル名と同じ画像が入ったフォルダ。ZIPなら不要です。名簿にいない ID は、名前があれば名簿に追加します(名簿の人は削除しません)" />

  <MemberFormDialog v-if="modalMode" :mode="modalMode" :member="modalData"
    :existing-directory-members="availableDirectoryMembers" @submit="onFormSubmit" @cancel="closeModal" />
</template>

<script setup lang="ts">
import { TableImportDialog, TableIoToolbar, UiButton, UiToolbar, toast, useConfirm } from '@octopus/ui-kit';
import { ref, onMounted, onBeforeUnmount } from 'vue';
import { container } from 'tsyringe';
import { eventBus } from '@octopus/client-common/events/event-bus';
import { AccountsRepository, MemberPhotoCache, rosterTableIo } from '@octopus/accounts';
import { MemberRepository } from '@model/member/member-repository';
import { jackpotMemberTable } from '@control/member-table/jackpot-member-table';
import { useMembers } from './use-members';
import type { MemberFormInput } from './use-members';
import MemberList from './components/member-list.vue';
import MemberFormDialog from './components/member-form-dialog.vue';

const {
  members,
  availableDirectoryMembers,
  selectedMembers,
  deleting,
  getMemberImageSrc,
  fetchMembers,
  addMember,
  updateMember,
  deleteMember,
  deleteSelectedMembers,
} = useMembers();

const { confirm } = useConfirm();

// CSV の書き出し・取込は設定>メンバーと同じ部品(写真の縮小・送信も同じ)。共有の名簿は消さないので、置き換えは付けない。
// ランク・当選しやすさの列は、名簿に書いたあと、拡張設定へ1回で反映する。
const memberIo = rosterTableIo({
  repo: container.resolve(AccountsRepository),
  photos: container.resolve(MemberPhotoCache),
  table: jackpotMemberTable(container.resolve(MemberRepository)),
  afterImport: fetchMembers,
  warn: (message) => toast.error(message),
});
const importOpen = ref(false);

const modalMode = ref<'add' | 'edit' | null>(null);
const modalData = ref<any>(null);
const openModal = (mode: 'add' | 'edit', data?: any) => {
  modalMode.value = mode;
  modalData.value = data || null;
};
const closeModal = () => {
  modalMode.value = null;
  modalData.value = null;
};

const onFormSubmit = async (input: MemberFormInput) => {
  if (modalMode.value === 'add') {
    await addMember(input);
  } else if (modalMode.value === 'edit' && modalData.value) {
    await updateMember(modalData.value, input);
  }
  closeModal();
};

/** 名簿からは消さず、ジャックポットの設定(ランク・当選しやすさ)だけを初期値に戻す。 */
const confirmReset = (message: string) =>
  confirm({ title: '設定を初期値に戻す', message: `${message}名簿からは削除されません(メンバーの追加・削除は 設定 > メンバー で行います)。`, confirmLabel: '初期値に戻す', danger: true });

const resetOne = async (id: string) => {
  if (await confirmReset('このメンバーのジャックポットの設定(ランク・当選しやすさ)を初期値に戻しますか?')) await deleteMember(id);
};
const resetSelected = async () => {
  if (await confirmReset(`選択した${selectedMembers.value.length}人のジャックポットの設定(ランク・当選しやすさ)を初期値に戻しますか?`)) await deleteSelectedMembers();
};

// 初めて開くブラウザでは、表示した後の背景同期でサーバーのデータが取り込まれる。取り込み完了時に一覧を読み直す
const reloadAfterSync = () => {
  void fetchMembers();
};

onMounted(async () => {
  eventBus.on('syncPulled', reloadAfterSync);
  await fetchMembers();
});

onBeforeUnmount(() => {
  eventBus.off('syncPulled', reloadAfterSync);
});
</script>
