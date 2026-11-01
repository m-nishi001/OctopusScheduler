import { afterEach, describe, expect, it, vi } from 'vitest';
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils';
import MemberEditor from './member-editor.vue';
import FeedbackHost from '../feedback/feedback-host.vue';
import { confirmQueue } from '../../composables/use-feedback';

const wrappers: VueWrapper[] = [];
afterEach(() => {
    wrappers.splice(0).forEach((w) => w.unmount());
    confirmQueue.splice(0);
});

function setup(props: Record<string, unknown> = {}) {
    const onAdd = vi.fn().mockResolvedValue(undefined);
    const onUpdate = vi.fn().mockResolvedValue(undefined);
    const onDelete = vi.fn().mockResolvedValue(undefined);
    const w = mount(MemberEditor, {
        props: { members: [{ id: 'a', name: 'Alice' }], onAdd, onUpdate, onDelete, ...props },
        attachTo: document.body,
    });
    wrappers.push(w, mount(FeedbackHost, { attachTo: document.body }));
    return { w, onAdd, onUpdate, onDelete };
}
const dialogButtons = () => Array.from(document.body.querySelectorAll<HTMLButtonElement>('.ui-dialog__footer button'));

describe('MemberEditor', () => {
    it('名前入力で追加でき、IDは空なら undefined', async () => {
        const { w, onAdd } = setup();
        await w.find('.ui-member-editor__toolbar button').trigger('click');
        await flushPromises();
        const inputs = document.body.querySelectorAll<HTMLInputElement>('.ui-member-editor__form input');
        inputs[1].value = 'Bob';
        inputs[1].dispatchEvent(new Event('input'));
        await flushPromises();
        dialogButtons()[1].click();
        await flushPromises();
        expect(onAdd).toHaveBeenCalledWith({ id: undefined, name: 'Bob' });
    });

    it('idRequired の場合はIDが空だと保存できない', async () => {
        const { w } = setup({ idRequired: true });
        await w.find('.ui-member-editor__toolbar button').trigger('click');
        await flushPromises();
        const inputs = document.body.querySelectorAll<HTMLInputElement>('.ui-member-editor__form input');
        inputs[1].value = 'Bob';
        inputs[1].dispatchEvent(new Event('input'));
        await flushPromises();
        expect(dialogButtons()[1].disabled).toBe(true);
    });

    it('削除は確認後に onDelete を呼ぶ', async () => {
        const { w, onDelete } = setup();
        await w.find('button[aria-label="削除"]').trigger('click');
        await flushPromises();
        const ok = Array.from(document.body.querySelectorAll<HTMLButtonElement>('.ui-dialog__footer button')).at(-1)!;
        ok.click();
        await flushPromises();
        expect(onDelete).toHaveBeenCalledWith(['a']);
    });

    it('確認でキャンセルすると削除しない', async () => {
        const { w, onDelete } = setup();
        await w.find('button[aria-label="削除"]').trigger('click');
        await flushPromises();
        document.body.querySelectorAll<HTMLButtonElement>('.ui-dialog__footer button')[0].click();
        await flushPromises();
        expect(onDelete).not.toHaveBeenCalled();
    });

    describe('写真', () => {
        const hash = 'aaaaaaaaaaaaaaaa';
        const pick = vi.fn().mockResolvedValue({ hash, url: 'data:image/webp;base64,QUJD' });
        const photoProps = () => ({ onPickPhoto: pick, photoUrls: { [hash]: 'data:image/webp;base64,QUJD' } });
        const chooseFile = async () => {
            const input = document.body.querySelector<HTMLInputElement>('[data-testid="member-photo-input"]')!;
            Object.defineProperty(input, 'files', { value: [new File(['x'], 'a.png', { type: 'image/png' })], configurable: true });
            input.dispatchEvent(new Event('change'));
            await flushPromises();
        };

        it('onPickPhoto が無ければ、写真の列も欄も出ない', async () => {
            const { w } = setup();
            expect(w.find('[data-testid="member-thumb"]').exists()).toBe(false);
            expect(w.text()).not.toContain('写真');
            await w.find('.ui-member-editor__toolbar button').trigger('click');
            await flushPromises();
            expect(document.body.querySelector('[data-testid="member-photo-input"]')).toBeNull();
        });

        it('写真を持つメンバーは一覧にサムネイルが出る。持たない人は頭文字', async () => {
            const { w } = setup({
                members: [{ id: 'a', name: 'Alice', photo: hash }, { id: 'b', name: 'Bob' }],
                ...photoProps(),
            });
            const thumbs = w.findAll('[data-testid="member-thumb"]');
            expect(thumbs).toHaveLength(1);
            expect(thumbs[0].attributes('src')).toBe('data:image/webp;base64,QUJD');
            expect(w.findAll('.ui-member-editor__thumb--empty')).toHaveLength(1);
        });

        it('追加で写真を選ぶと、そのハッシュつきで onAdd を呼ぶ', async () => {
            const { w, onAdd } = setup(photoProps());
            await w.find('.ui-member-editor__toolbar button').trigger('click');
            await flushPromises();
            const inputs = document.body.querySelectorAll<HTMLInputElement>('.ui-member-editor__form input[type="text"]');
            inputs[1].value = 'Bob';
            inputs[1].dispatchEvent(new Event('input'));
            await chooseFile();
            expect(pick).toHaveBeenCalled();
            expect(document.body.querySelector('[data-testid="member-photo-preview"]')).not.toBeNull();
            dialogButtons()[1].click();
            await flushPromises();
            expect(onAdd).toHaveBeenCalledWith({ id: undefined, name: 'Bob', photo: hash });
        });

        it('編集で写真を触らなければ photo は省略(既存を保つ)。外すと空文字、選べばそのハッシュ', async () => {
            const members = [{ id: 'a', name: 'Alice', photo: hash }];
            const { w, onUpdate } = setup({ members, ...photoProps() });
            await w.find('button[aria-label="編集"]').trigger('click');
            await flushPromises();
            dialogButtons()[1].click();
            await flushPromises();
            expect(onUpdate).toHaveBeenLastCalledWith({ id: 'a', name: 'Alice', photo: undefined });

            await w.find('button[aria-label="編集"]').trigger('click');
            await flushPromises();
            document.body.querySelector<HTMLButtonElement>('[data-testid="member-photo-clear"]')!.click();
            await flushPromises();
            dialogButtons()[1].click();
            await flushPromises();
            expect(onUpdate).toHaveBeenLastCalledWith({ id: 'a', name: 'Alice', photo: '' });

            await w.find('button[aria-label="編集"]').trigger('click');
            await flushPromises();
            await chooseFile();
            dialogButtons()[1].click();
            await flushPromises();
            expect(onUpdate).toHaveBeenLastCalledWith({ id: 'a', name: 'Alice', photo: hash });
        });

        it('写真の保存に失敗したら、エラーを出して、写真は変えない', async () => {
            const failing = vi.fn().mockRejectedValue(new Error('too large'));
            const { w, onAdd } = setup({ onPickPhoto: failing });
            await w.find('.ui-member-editor__toolbar button').trigger('click');
            await flushPromises();
            await chooseFile();
            expect(document.body.textContent).toContain('写真を保存できませんでした: too large');
            const inputs = document.body.querySelectorAll<HTMLInputElement>('.ui-member-editor__form input[type="text"]');
            inputs[1].value = 'Bob';
            inputs[1].dispatchEvent(new Event('input'));
            await flushPromises();
            dialogButtons()[1].click();
            await flushPromises();
            expect(onAdd).toHaveBeenCalledWith({ id: undefined, name: 'Bob', photo: undefined });
        });
    });
});

describe('MemberEditor の CSV 書き出し・取込', () => {
    it('書き出し・取込の指定が無ければボタンを出さない', () => {
        const { w } = setup();
        expect(w.find('[data-testid="table-export"]').exists()).toBe(false);
        expect(w.find('[data-testid="table-import-open"]').exists()).toBe(false);
    });

    it('「写真も含める」は写真の欄があるときだけ。チェックで includeMedia', async () => {
        const onExport = vi.fn().mockResolvedValue(undefined);
        const { w } = setup({ onExport });
        expect(w.find('[data-testid="table-export-media"]').exists()).toBe(false);
        await w.find('[data-testid="table-export"]').trigger('click');
        expect(onExport).toHaveBeenLastCalledWith({ includeMedia: false });

        const withPhotos = setup({ onExport, onPickPhoto: vi.fn() }).w;
        await withPhotos.find('[data-testid="table-export-media"]').setValue(true);
        await withPhotos.find('[data-testid="table-export"]').trigger('click');
        expect(onExport).toHaveBeenLastCalledWith({ includeMedia: true });
    });

    it('取込を開き、allowReplace のときだけ置き換えのチェックを出す。件数は members の数', async () => {
        const onPreviewImport = vi.fn();
        const { w } = setup({ onPreviewImport });
        expect(w.find('[data-testid="table-count"]').text()).toBe('1件');
        await w.find('[data-testid="table-import-open"]').trigger('click');
        await flushPromises();
        expect(document.body.querySelector('[data-testid="table-import-table"]')).not.toBeNull();
        expect(document.body.querySelector('[data-testid="table-import-replace"]')).toBeNull();
        const replaceable = setup({ onPreviewImport, allowReplace: true });
        await replaceable.w.find('[data-testid="table-import-open"]').trigger('click');
        await flushPromises();
        expect(document.body.querySelector('[data-testid="table-import-replace"]')).not.toBeNull();
    });
});
