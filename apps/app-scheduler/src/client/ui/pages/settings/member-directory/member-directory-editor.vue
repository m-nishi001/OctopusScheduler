<template>
    <div class="member-directory-editor">
        <p class="member-directory-editor__description">
            ここで登録したメンバーは、各ゲーム(ジャックポット・クイズなど)の管理画面から共通の名簿として参照できます。
        </p>
        <MemberEditor :members="members" :loading="loading" :on-add="addMember" :on-update="updateWithPhoto"
            :on-delete="deleteMembers" :on-pick-photo="pickPhoto" :photo-urls="photoUrls" :on-export="exportMembers"
            :on-preview-import="previewImport" />
    </div>
</template>

<script setup lang="ts">
import { onMounted, reactive, watch } from 'vue';
import { container } from 'tsyringe';
import { MemberEditor, toast } from '@octopus/ui-kit';
import type { MemberImportInput, MemberImportPreview } from '@octopus/ui-kit';
import { useCachedCollection } from '@octopus/composables';
import { AccountsRepository, MemberPhotoCache, exportRoster, preparePhoto, previewRosterImport, uploadMemberPhotos } from '@octopus/accounts';
import type { Member } from '@octopus/accounts';

const repo = container.resolve(AccountsRepository);
const photos = container.resolve(MemberPhotoCache);

// IndexedDB のキャッシュを即表示し、背景で最新化。更新/削除は楽観的に反映する。
const { items: members, loading, error, load, add: addMember, update: updateMember, remove: deleteMembers } =
    useCachedCollection<Member, { id?: string; name: string; photo?: string }>({
        key: 'member-directory',
        list: () => repo.listMembers(),
        add: (input) => repo.addMember(input),
        // 画面側で写真を確定させた姿を渡す。写真なし(undefined)は、サーバーへは空文字(外す)として伝える。
        update: (member) => repo.updateMember({ ...member, photo: member.photo ?? '' }),
        remove: (id) => repo.deleteMember(id),
    });

/** 画面が受け取った更新を、写真を含めた最終の姿にする(省略=いまの写真を保つ、空文字=外す)。 */
const updateWithPhoto = (input: { id: string; name: string; photo?: string }) => {
    const current = members.value.find((m) => m.id === input.id);
    const photo = input.photo === undefined ? current?.photo : input.photo || undefined;
    return updateMember({ ...current, id: input.id, name: input.name, photo });
};

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

/** 選んだ写真を縮小し、サーバーへ送って(同じ写真があれば送らない)、名簿に記録するハッシュを返す。 */
async function pickPhoto(file: File) {
    const prepared = await preparePhoto(file);
    await uploadMemberPhotos(repo, [prepared]);
    await photos.remember(prepared.hash, prepared.dataUrl);
    photoUrls[prepared.hash] = prepared.dataUrl;
    return { hash: prepared.hash, url: prepared.dataUrl };
}

/** いまの名簿を CSV(写真も含めるときは ZIP)にしてダウンロードする。取込と同じ書式。 */
async function exportMembers({ includePhotos }: { includePhotos: boolean }) {
    const out = await exportRoster(await repo.listMembers(), { includePhotos }, photos);
    const url = URL.createObjectURL(new Blob([out.bytes as BlobPart], { type: out.mime }));
    const link = document.createElement('a');
    link.href = url;
    link.download = out.filename;
    link.click();
    URL.revokeObjectURL(url);
    if (out.missingPhotos > 0) toast.error(`${out.missingPhotos}人の写真を取得できず、含めていません`);
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

onMounted(async () => {
    await load();
    if (error.value) toast.error('メンバー一覧の更新に失敗しました(保存済みの内容を表示しています)');
});
</script>

<style scoped>
.member-directory-editor__description {
    margin: 0 0 var(--ui-space-3, 12px);
    color: var(--ui-text-muted, #cfd6dd);
    font-size: var(--ui-font-sm, 0.875rem);
}
</style>
