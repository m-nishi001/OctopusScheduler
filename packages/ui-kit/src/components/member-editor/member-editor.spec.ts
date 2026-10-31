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
    const files = (el: HTMLInputElement, list: File[]) => {
        Object.defineProperty(el, 'files', { value: list, configurable: true });
        el.dispatchEvent(new Event('change'));
    };
    const preview = (apply = vi.fn().mockResolvedValue({ summary: '追加 1', details: ['所要時間 0.1秒'] })) => ({
        ok: true as const,
        rows: [
            { line: 2, id: 'n1', name: 'New', status: 'add' as const },
            { line: 3, id: '', name: '', status: 'error' as const, message: '名前が空です' },
        ],
        counts: { add: 1, update: 0, unchanged: 0, error: 1 },
        apply,
    });

    it('書き出し・取込の指定が無ければボタンを出さない', () => {
        const { w } = setup();
        expect(w.find('[data-testid="member-export"]').exists()).toBe(false);
        expect(w.find('[data-testid="member-import-open"]').exists()).toBe(false);
    });

    it('CSVダウンロード: 「写真も含める」は写真の欄があるときだけ。チェックで includePhotos', async () => {
        const onExport = vi.fn().mockResolvedValue(undefined);
        const { w } = setup({ onExport });
        expect(w.find('[data-testid="member-export-photos"]').exists()).toBe(false);
        await w.find('[data-testid="member-export"]').trigger('click');
        expect(onExport).toHaveBeenLastCalledWith({ includePhotos: false });

        const withPhotos = setup({ onExport, onPickPhoto: vi.fn() }).w;
        await withPhotos.find('[data-testid="member-export-photos"]').setValue(true);
        await withPhotos.find('[data-testid="member-export"]').trigger('click');
        expect(onExport).toHaveBeenLastCalledWith({ includePhotos: true });
    });

    it('書き出しに失敗したらエラーを出す', async () => {
        const { w } = setup({ onExport: vi.fn().mockRejectedValue(new Error('boom')) });
        await w.find('[data-testid="member-export"]').trigger('click');
        await flushPromises();
        expect(document.body.textContent).toContain('書き出しに失敗しました: boom');
    });

    it('取込: ファイルを選ぶと行ごとの結果が出て、確定すると結果を表示する。エラー行があっても取り込める行があれば確定できる', async () => {
        const apply = vi.fn().mockImplementation(async (onProgress: (m: string) => void) => {
            onProgress('写真を送っています(1/1)');
            return { summary: '追加 1 / 更新 0', details: ['所要時間 0.1秒'] };
        });
        const onPreviewImport = vi.fn().mockResolvedValue(preview(apply));
        const { w } = setup({ onPreviewImport });
        await w.find('[data-testid="member-import-open"]').trigger('click');
        await flushPromises();
        const confirm = () => dialogButtons()[1];
        expect(confirm().disabled).toBe(true);

        const image = new File(['x'], 'n1.png', { type: 'image/png' });
        files(document.body.querySelector('[data-testid="member-import-table"]') as HTMLInputElement, [new File(['ID,名前'], 'm.csv')]);
        files(document.body.querySelector('[data-testid="member-import-images"]') as HTMLInputElement, [image]);
        await flushPromises();
        expect(onPreviewImport).toHaveBeenLastCalledWith({ table: expect.objectContaining({ name: 'm.csv' }), images: [image] });
        expect(document.body.querySelector('[data-testid="member-import-counts"]')?.textContent).toContain('追加 1 / 更新 0 / 変更なし 0 / エラー 1');
        const rows = Array.from(document.body.querySelectorAll('[data-testid="member-import-row"]'));
        expect(rows.map((r) => r.getAttribute('data-status'))).toEqual(['add', 'error']);
        expect(rows[1].textContent).toContain('名前が空です');

        expect(confirm().disabled).toBe(false);
        confirm().click();
        await flushPromises();
        expect(apply).toHaveBeenCalledTimes(1);
        expect(document.body.querySelector('[data-testid="member-import-result"]')?.textContent).toContain('追加 1 / 更新 0');
        expect(document.body.querySelector('[data-testid="member-import-details"]')?.textContent).toContain('所要時間');
    });

    it('CSVが読めなければ理由を出して確定できない。確定に失敗したら理由を出し、もう一度押せる', async () => {
        const onPreviewImport = vi.fn().mockResolvedValueOnce({ ok: false, errors: ['ヘッダー行に ID の列がありません'] });
        const { w } = setup({ onPreviewImport });
        await w.find('[data-testid="member-import-open"]').trigger('click');
        await flushPromises();
        files(document.body.querySelector('[data-testid="member-import-table"]') as HTMLInputElement, [new File(['x'], 'bad.csv')]);
        await flushPromises();
        expect(document.body.querySelector('[data-testid="member-import-errors"]')?.textContent).toContain('ID の列がありません');
        expect(dialogButtons()[1].disabled).toBe(true);

        const apply = vi.fn().mockRejectedValueOnce(new Error('network')).mockResolvedValueOnce({ summary: 'ok', details: [] });
        onPreviewImport.mockResolvedValue(preview(apply));
        files(document.body.querySelector('[data-testid="member-import-table"]') as HTMLInputElement, [new File(['x'], 'good.csv')]);
        await flushPromises();
        dialogButtons()[1].click();
        await flushPromises();
        expect(document.body.querySelector('[data-testid="member-import-error"]')?.textContent).toContain('network');
        dialogButtons()[1].click();
        await flushPromises();
        expect(document.body.querySelector('[data-testid="member-import-result"]')?.textContent).toContain('ok');
    });
});
