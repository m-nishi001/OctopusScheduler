<template>
    <section class="members-editor">
        <p v-if="!hasLoginableAdmin" class="members-editor__warning" role="alert">
            パスワード設定済みの管理者がいません。この状態で全員がログアウトすると、管理画面にログインできなくなります。
        </p>

        <p v-if="capacity" class="members-editor__capacity" :class="`is-${capacity.level}`"
            :role="capacity.level === 'ok' ? undefined : 'alert'" data-testid="roster-capacity">
            {{ capacity.message }}
        </p>

        <div class="members-editor__toolbar">
            <UiButton variant="primary" icon="add" data-testid="member-add" @click="openAdd">追加</UiButton>
            <UiButton v-if="selectedIds.length" variant="danger" icon="delete" :loading="removing" @click="removeSelected">
                選択を削除({{ selectedIds.length }})
            </UiButton>
            <UiButton icon="download" :loading="exporting" data-testid="member-export" @click="exportCsv">CSVダウンロード</UiButton>
            <label class="members-editor__export-option">
                <input v-model="includePhotos" type="checkbox" data-testid="member-export-photos" />
                写真も含める(ZIP)
            </label>
            <UiButton icon="upload" data-testid="member-import-open" @click="importOpen = true">CSVから取り込む</UiButton>
            <UiButton :disabled="issuing || withoutKey.length === 0" :loading="issuing" data-testid="member-issue-missing"
                @click="issueMissing">
                未発行の参加者に受付QRを発行({{ withoutKey.length }}人)
            </UiButton>
            <span class="members-editor__count">{{ members.length }}件</span>
        </div>

        <DataTable :columns="columns" :rows="members" row-key="id" selectable v-model:selected="selectedIds"
            :loading="loading" empty-text="メンバーはいません">
            <template #cell-photo="{ row }">
                <img v-if="row.photo && photoUrls[row.photo]" class="members-editor__thumb" :src="photoUrls[row.photo]"
                    :alt="`${row.name}の写真`" data-testid="member-thumb" />
                <span v-else class="members-editor__thumb members-editor__thumb--empty" aria-hidden="true">{{ initialOf(row.name) }}</span>
            </template>
            <template #cell-isAdmin="{ row }">{{ row.isAdmin ? '管理者' : '一般' }}</template>
            <template #cell-hasPassword="{ row }">{{ row.hasPassword ? '設定済み' : '未設定' }}</template>
            <template #cell-hasLoginKey="{ row }">
                <template v-if="row.isAdmin">—</template>
                <template v-else>{{ row.hasLoginKey ? '発行済み' : '未発行' }}</template>
            </template>
            <template #cell-actions="{ row }">
                <div class="members-editor__row-actions">
                    <UiButton v-if="!row.isAdmin" size="sm" :disabled="issuing"
                        :aria-label="`${row.name} の受付QRを${row.hasLoginKey ? '再発行' : '発行'}`" @click="issueOne(row)">
                        {{ row.hasLoginKey ? 'QR再発行' : 'QR発行' }}
                    </UiButton>
                    <UiButton size="sm" icon="edit" icon-only aria-label="編集" @click="openEdit(row)" />
                    <UiButton size="sm" variant="danger" icon="delete" icon-only aria-label="削除" @click="removeOne(row)" />
                </div>
            </template>
        </DataTable>

        <MemberImportDialog v-model="importOpen" :on-preview="previewImport" />

        <UiDialog v-model="dialogOpen" :title="editing ? 'メンバー編集' : 'メンバー追加'" size="sm" :persistent="saving"
            confirm-label="保存" :loading="saving" :confirm-disabled="!canSave" @confirm="save">
            <form class="members-editor__form" @submit.prevent="save">
                <UiField label="ID" :required="!editing">
                    <input v-model="formId" type="text" :disabled="!!editing" autocomplete="off" />
                </UiField>
                <UiField label="名前" required>
                    <input v-model="formName" type="text" autocomplete="off" />
                </UiField>
                <UiField label="写真(任意)" hint="長辺512pxに縮小して保存します">
                    <div class="members-editor__photo">
                        <img v-if="dialogPhotoUrl" class="members-editor__thumb members-editor__thumb--lg" :src="dialogPhotoUrl"
                            alt="選んだ写真" data-testid="member-photo-preview" />
                        <span v-else class="members-editor__thumb members-editor__thumb--lg members-editor__thumb--empty"
                            aria-hidden="true">{{ initialOf(formName) }}</span>
                        <div class="members-editor__photo-actions">
                            <input type="file" accept="image/*" :disabled="picking || saving" data-testid="member-photo-input"
                                aria-label="写真を選ぶ" @change="pickPhoto" />
                            <UiButton v-if="dialogPhotoUrl" size="sm" variant="danger" :disabled="picking || saving"
                                data-testid="member-photo-clear" @click="clearPhoto">写真を外す</UiButton>
                            <span v-if="picking" class="members-editor__photo-status">写真を処理しています…</span>
                        </div>
                    </div>
                </UiField>
                <fieldset class="members-editor__login">
                    <legend>ログイン</legend>
                    <label class="members-editor__check">
                        <input v-model="formIsAdmin" type="checkbox" data-testid="member-is-admin" />
                        管理者にする
                    </label>
                    <UiField :label="editing ? '新しいパスワード' : 'パスワード'"
                        :hint="`${MIN_PASSWORD_LENGTH}文字以上。${editing ? '空欄なら変更しません' : '管理者はログインに必要です(参加者は受付QRだけでも入れます)'}`"
                        :error="formError">
                        <input v-model="formPassword" type="password" autocomplete="new-password" data-testid="member-password" />
                    </UiField>
                </fieldset>
            </form>
        </UiDialog>

        <LoginQrSheet v-model="sheetOpen" :cards="sheetCards" />
    </section>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue';
import { container } from 'tsyringe';
import { DataTable, MemberImportDialog, UiButton, UiDialog, UiField, toast, useConfirm } from '@octopus/ui-kit';
import type { DataTableColumn, MemberImportInput, MemberImportPreview } from '@octopus/ui-kit';
import {
    AccountsRepository,
    MemberPhotoCache,
    exportRoster,
    preparePhoto,
    previewRosterImport,
    uploadMemberPhotos,
} from '@octopus/accounts';
import type { Member, RosterUsage } from '@octopus/accounts';
import { SessionAdminRepository, buildLoginUrl } from '@octopus/session-hub';
import { useAuthSession } from '../../../../control/auth/auth-session';
import LoginQrSheet from './login-qr-sheet.vue';
import type { LoginQrCard } from './login-qr-sheet.vue';
import { qrDataUrl } from './login-qr';
import { describeRosterCapacity } from './roster-capacity';

/** サーバー側 setPassword の最小文字数(accounts-use-cases.ts の MIN_PASSWORD_LENGTH と同じ)。 */
const MIN_PASSWORD_LENGTH = 8;

const repo = container.resolve(AccountsRepository);
const photos = container.resolve(MemberPhotoCache);
const { confirm, confirmDelete } = useConfirm();
const { currentMember } = useAuthSession();

const columns: DataTableColumn[] = [
    { key: 'id', label: 'ID', sortable: true },
    { key: 'photo', label: '写真', class: 'members-editor__photo-col' },
    { key: 'name', label: '名前', sortable: true },
    { key: 'isAdmin', label: '権限' },
    { key: 'hasPassword', label: 'パスワード' },
    { key: 'hasLoginKey', label: '受付QR' },
    { key: 'actions', label: '操作' },
];

const initialOf = (name: string): string => Array.from(name.trim())[0] ?? '?';

// 名簿は listAccounts で1回だけ読む(写真・パスワード・受付QRの状態を含む)。端末内には保存しない。
const members = ref<Member[]>([]);
const loading = ref(false);

const hasLoginableAdmin = computed(() => members.value.some((a) => a.isAdmin && a.hasPassword));

/** 名簿の容量の使用状況(上限のある保存先でだけ表示する)。取得に失敗しても一覧の表示は止めない。 */
const usage = ref<RosterUsage | null>(null);
const capacity = computed(() => (usage.value ? describeRosterCapacity(usage.value) : null));

// 一覧のサムネイル。写真は共通のキャッシュ(端末内・ハッシュ別)から引く。
const photoUrls = reactive<Record<string, string>>({});
watch(
    members,
    async (list) => {
        const hashes = list.map((m) => m.photo).filter((h): h is string => !!h);
        await photos.ensure(hashes);
        for (const hash of hashes) {
            const url = photos.get(hash);
            if (url) photoUrls[hash] = url;
        }
    },
    { immediate: true },
);

async function load() {
    loading.value = true;
    try {
        members.value = await repo.listAccounts();
        usage.value = await repo.getRosterUsage().catch(() => null);
    } catch (e) {
        toast.error(`メンバー一覧の取得に失敗しました: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
        loading.value = false;
    }
}

onMounted(load);

// ---- 受付QR(参加者ごとのログインキー) ----
// 平文のキーは発行直後の1回しか見られないため、シートを開いている間だけ画面に保持し、閉じたら破棄する。
const sessionAdmin = container.resolve(SessionAdminRepository);
const issuing = ref(false);
const sheetOpen = ref(false);
const sheetCards = ref<LoginQrCard[]>([]);
const withoutKey = computed(() => members.value.filter((a) => !a.isAdmin && !a.hasLoginKey));

watch(sheetOpen, (open) => {
    if (!open) sheetCards.value = [];
});

/** 順番に(1人ずつ)発行する。途中で失敗しても、そこまでに発行できた分はシートに出す。 */
async function issueFor(rows: Member[]) {
    if (issuing.value || rows.length === 0) return;
    issuing.value = true;
    const cards: LoginQrCard[] = [];
    try {
        const base = await sessionAdmin.appBaseUrl();
        for (const row of rows) {
            const key = await repo.issueLoginKey(row.id);
            cards.push({ id: row.id, name: row.name, qr: qrDataUrl(buildLoginUrl(row.id, key, base)) });
        }
    } catch (e) {
        toast.error(`受付QRの発行に失敗しました: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
        issuing.value = false;
    }
    if (cards.length > 0) {
        sheetCards.value = cards;
        sheetOpen.value = true;
    }
    await load();
}

async function issueOne(row: Member) {
    if (row.hasLoginKey) {
        const ok = await confirm({
            title: '受付QRの再発行',
            message: `「${row.name}」のQRコードを再発行します。すでに配布したQRコードは使えなくなります。`,
            confirmLabel: '再発行',
            danger: true,
        });
        if (!ok) return;
    }
    await issueFor([row]);
}

async function issueMissing() {
    await issueFor(withoutKey.value);
}

// ---- 追加・編集 ----
const dialogOpen = ref(false);
const editing = ref<Member | null>(null);
const formId = ref('');
const formName = ref('');
const formIsAdmin = ref(false);
const formPassword = ref('');
const formError = ref('');
const saving = ref(false);
/** 写真の入力。undefined=変えない、''=外す、それ以外=選んだ写真のハッシュ。 */
const formPhoto = ref<string | undefined>(undefined);
const pickedUrl = ref<string | undefined>(undefined);
const picking = ref(false);

/** 編集中のメンバーの、いまの(または選び直した)写真のURL。 */
const dialogPhotoUrl = computed(() => {
    if (formPhoto.value === '') return undefined;
    if (formPhoto.value !== undefined) return pickedUrl.value;
    const current = editing.value?.photo;
    return current ? photoUrls[current] : undefined;
});

const canSave = computed(
    () =>
        !picking.value &&
        !!formName.value.trim() &&
        (!!editing.value || !!formId.value.trim()) &&
        (!formPassword.value || formPassword.value.length >= MIN_PASSWORD_LENGTH),
);

function resetForm(row: Member | null) {
    editing.value = row;
    formId.value = row?.id ?? '';
    formName.value = row?.name ?? '';
    formIsAdmin.value = row?.isAdmin === true;
    formPassword.value = '';
    formError.value = '';
    formPhoto.value = undefined;
    pickedUrl.value = undefined;
    dialogOpen.value = true;
}

const openAdd = () => resetForm(null);
const openEdit = (row: Member) => resetForm(row);

/** 選んだ写真を縮小し、サーバーへ送って(同じ写真があれば送らない)、名簿に記録するハッシュを得る。 */
async function pickPhoto(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    picking.value = true;
    formError.value = '';
    try {
        const prepared = await preparePhoto(file);
        await uploadMemberPhotos(repo, [prepared]);
        await photos.remember(prepared.hash, prepared.dataUrl);
        photoUrls[prepared.hash] = prepared.dataUrl;
        formPhoto.value = prepared.hash;
        pickedUrl.value = prepared.dataUrl;
    } catch (e) {
        formError.value = `写真を保存できませんでした: ${e instanceof Error ? e.message : String(e)}`;
    } finally {
        picking.value = false;
    }
}

function clearPhoto() {
    formPhoto.value = '';
    pickedUrl.value = undefined;
}

async function save() {
    if (!canSave.value || saving.value) return;
    // 自分自身の管理者権限を外すと、その場から操作できなくなる
    if (editing.value && editing.value.id === currentMember.value?.id && !formIsAdmin.value) {
        formError.value = 'ログイン中のアカウントの管理者権限は外せません';
        return;
    }
    saving.value = true;
    formError.value = '';
    try {
        const name = formName.value.trim();
        const id = editing.value
            ? (await repo.updateMember({ id: editing.value.id, name, isAdmin: formIsAdmin.value, photo: formPhoto.value })).id
            : (await repo.addMember({ id: formId.value.trim(), name, isAdmin: formIsAdmin.value, photo: formPhoto.value || undefined })).id;
        // 先に作成/更新して成功してから、パスワードを設定する
        if (formPassword.value) await repo.setPassword(id, formPassword.value);
        dialogOpen.value = false;
        await load();
    } catch (e) {
        formError.value = e instanceof Error ? e.message : String(e);
    } finally {
        saving.value = false;
    }
}

// ---- 削除 ----
const selectedIds = ref<string[]>([]);
const removing = ref(false);

async function removeIds(ids: string[], message: string) {
    if (currentMember.value && ids.includes(currentMember.value.id)) {
        toast.error('ログイン中のアカウントは削除できません');
        return;
    }
    if (!(await confirmDelete(message))) return;
    removing.value = true;
    try {
        for (const id of ids) await repo.deleteMember(id);
    } catch (e) {
        toast.error(`削除に失敗しました: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
        removing.value = false;
        selectedIds.value = selectedIds.value.filter((id) => !ids.includes(id));
        await load();
    }
}

const removeOne = (row: Member) => removeIds([row.id], `「${row.name}」を削除しますか?`);
const removeSelected = () => removeIds([...selectedIds.value], `選択した${selectedIds.value.length}件を削除しますか?`);

// ---- CSV ----
const includePhotos = ref(false);
const exporting = ref(false);
const importOpen = ref(false);

/** いまの名簿を CSV(写真も含めるときは ZIP)にしてダウンロードする。取込と同じ書式。 */
async function exportCsv() {
    if (exporting.value) return;
    exporting.value = true;
    try {
        const out = await exportRoster(await repo.listMembers(), { includePhotos: includePhotos.value }, photos);
        const url = URL.createObjectURL(new Blob([out.bytes as BlobPart], { type: out.mime }));
        const link = document.createElement('a');
        link.href = url;
        link.download = out.filename;
        link.click();
        URL.revokeObjectURL(url);
        if (out.missingPhotos > 0) toast.error(`${out.missingPhotos}人の写真を取得できず、含めていません`);
    } catch (e) {
        toast.error(`書き出しに失敗しました: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
        exporting.value = false;
    }
}

const seconds = (ms: number) => `${(ms / 1000).toFixed(1)}秒`;

/** 選んだ CSV・画像を読んでプレビューを作る。確定すると、写真を並列に送ってから名簿を1回だけ書く。 */
async function previewImport(input: MemberImportInput): Promise<MemberImportPreview> {
    const preview = await previewRosterImport(input, { repo, photoCache: photos });
    if (!preview.ok) return preview;
    return {
        ok: true,
        rows: preview.plan.rows,
        counts: preview.plan.counts,
        apply: async (onProgress) => {
            const s = await preview.apply(onProgress);
            await load();
            const skipped = s.failedRows ? `、画像を処理できず取り込めなかった行 ${s.failedRows}` : '';
            return {
                summary: `追加 ${s.added} / 更新 ${s.updated} / 変更なし ${s.unchanged} / エラーで除外 ${s.errors}${skipped}`,
                details: [
                    `写真: 送信 ${s.uploaded}枚 / サーバーに既にあった ${s.alreadyOnServer}枚`,
                    `所要時間 ${seconds(s.totalMs)}(縮小 ${seconds(s.prepareMs)} / 送信 ${seconds(s.uploadMs)})`,
                    `同時送信の最大数 ${s.maxConcurrentUploads} / 回数制限(429)で待った回数 ${s.rateLimited}`,
                ],
            };
        },
    };
}
</script>

<style scoped>
.members-editor {
    display: flex;
    flex-direction: column;
    gap: var(--ui-space-3, 12px);
    min-width: 0;
}

.members-editor__warning {
    margin: 0;
    font-size: var(--ui-font-sm, 0.875rem);
    color: var(--ui-danger, #e5484d);
}

.members-editor__capacity {
    margin: 0;
    font-size: var(--ui-font-sm, 0.875rem);
    color: var(--ui-text-muted, #6b7280);
}

.members-editor__capacity.is-warn {
    color: var(--ui-warning, #b45309);
}

.members-editor__capacity.is-full {
    color: var(--ui-danger, #e5484d);
}

.members-editor__toolbar {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: var(--ui-space-2, 8px);
}

.members-editor__export-option {
    display: inline-flex;
    align-items: center;
    gap: var(--ui-space-1, 4px);
    font-size: var(--ui-font-sm, 0.875rem);
}

.members-editor__count {
    margin-left: auto;
    color: var(--ui-text-muted, #cfd6dd);
    font-size: var(--ui-font-sm, 0.875rem);
}

.members-editor__row-actions {
    display: flex;
    flex-wrap: wrap;
    gap: var(--ui-space-2, 8px);
}

.members-editor__thumb {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 36px;
    height: 36px;
    border-radius: 50%;
    object-fit: cover;
    vertical-align: middle;
}

.members-editor__thumb--lg {
    width: 72px;
    height: 72px;
    flex: none;
    font-size: 1.5rem;
}

.members-editor__thumb--empty {
    background: var(--ui-surface-2, #2a3138);
    color: var(--ui-text-muted, #cfd6dd);
    font-weight: 700;
}

.members-editor__photo {
    display: flex;
    align-items: center;
    gap: var(--ui-space-3, 12px);
}

.members-editor__photo-actions {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: var(--ui-space-2, 8px);
    min-width: 0;
}

.members-editor__photo-status {
    color: var(--ui-text-muted, #cfd6dd);
    font-size: var(--ui-font-sm, 0.875rem);
}

.members-editor__form {
    display: flex;
    flex-direction: column;
    gap: var(--ui-space-3, 12px);
}

.members-editor__login {
    display: flex;
    flex-direction: column;
    gap: var(--ui-space-3, 12px);
    margin: 0;
    padding: var(--ui-space-3, 12px);
    border: 1px solid var(--ui-border, #3a424a);
    border-radius: var(--ui-radius, 8px);
    min-width: 0;
}

.members-editor__login legend {
    padding: 0 var(--ui-space-1, 4px);
    font-size: var(--ui-font-sm, 0.875rem);
    color: var(--ui-text-muted, #cfd6dd);
}

.members-editor__check {
    display: flex;
    align-items: center;
    gap: var(--ui-space-2, 8px);
    font-size: var(--ui-font-sm, 0.875rem);
}
</style>
