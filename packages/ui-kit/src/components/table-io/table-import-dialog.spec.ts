import { afterEach, describe, expect, it, vi } from 'vitest';
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils';
import TableImportDialog from './table-import-dialog.vue';
import FeedbackHost from '../feedback/feedback-host.vue';
import { confirmQueue, resolveConfirm } from '../../composables/use-feedback';
import type { TableImportInput, TableImportPreview, TableImportRow, TableImportStatus } from './types';

const wrappers: VueWrapper[] = [];
afterEach(() => {
    wrappers.splice(0).forEach((w) => w.unmount());
    confirmQueue.splice(0);
});

const q = <T extends Element = HTMLElement>(id: string) => document.body.querySelector<T>(`[data-testid="${id}"]`);
const confirmButton = () => document.body.querySelectorAll<HTMLButtonElement>('.ui-dialog__footer button')[1];
const files = (el: HTMLInputElement, list: File[]) => {
    Object.defineProperty(el, 'files', { value: list, configurable: true });
    el.dispatchEvent(new Event('change'));
};

const counts = (c: Partial<Record<TableImportStatus, number>>) => ({ add: 0, update: 0, unchanged: 0, delete: 0, error: 0, ...c });
const row = (line: number | null, key: string, status: TableImportStatus, message?: string): TableImportRow => ({ line, key, label: key, status, message });
const okPreview = (rows: TableImportRow[], apply = vi.fn().mockResolvedValue({ summary: '追加 1', details: ['所要時間 0.1秒'] })): TableImportPreview => {
    const c = counts({});
    for (const r of rows) c[r.status]++;
    return { ok: true, rows, counts: c, apply };
};

async function open(onPreview: (input: TableImportInput) => Promise<TableImportPreview>, props: Record<string, unknown> = {}) {
    const w = mount(TableImportDialog, { props: { modelValue: true, onPreview, ...props }, attachTo: document.body });
    wrappers.push(w, mount(FeedbackHost, { attachTo: document.body }));
    await flushPromises();
    return w;
}
const pickCsv = async (name = 'm.csv') => {
    files(q<HTMLInputElement>('table-import-table')!, [new File(['x'], name)]);
    await flushPromises();
};

describe('TableImportDialog', () => {
    it('ファイルを選ぶと行・件数・素材の件数が出て、確定すると進捗のあと結果を表示する', async () => {
        const apply = vi.fn().mockImplementation(async (onProgress: (m: string) => void) => {
            onProgress('送っています');
            return { summary: '追加 1 / 更新 0', details: ['所要時間 0.1秒'] };
        });
        const preview = { ...okPreview([row(2, 'n1', 'add'), row(3, 'n2', 'unchanged')], apply), media: { added: 2, replaced: 1 } } as TableImportPreview;
        const onPreview = vi.fn().mockResolvedValue(preview);
        await open(onPreview);
        expect(confirmButton().disabled).toBe(true);

        const image = new File(['x'], 'n1.png');
        await pickCsv();
        files(q<HTMLInputElement>('table-import-media')!, [image]);
        await flushPromises();
        expect(onPreview).toHaveBeenLastCalledWith({ table: expect.objectContaining({ name: 'm.csv' }), media: [image], mode: 'upsert' });
        expect(q('table-import-counts')?.textContent).toContain('追加 1 / 更新 0 / 変更なし 1 / エラー 0');
        expect(q('table-import-media-counts')?.textContent).toContain('追加 2 / 差し替え 1');
        expect(Array.from(document.body.querySelectorAll('[data-testid="table-import-row"]')).map((r) => r.getAttribute('data-status'))).toEqual(['add', 'unchanged']);

        confirmButton().click();
        await flushPromises();
        expect(apply).toHaveBeenCalledTimes(1);
        expect(q('table-import-result')?.textContent).toContain('追加 1 / 更新 0');
        expect(q('table-import-details')?.textContent).toContain('所要時間');
        expect(q('table-import-close')).not.toBeNull();
    });

    it('エラーの行が1つでもあれば確定できない(取り込める行があっても)', async () => {
        await open(vi.fn().mockResolvedValue(okPreview([row(2, 'n1', 'add'), row(3, '', 'error', '名前が空です')])));
        await pickCsv();
        expect(q('table-import-blocked')?.textContent).toContain('エラーの行があるため取り込めません');
        expect(document.body.querySelectorAll('[data-testid="table-import-row"]')[1].textContent).toContain('名前が空です');
        expect(confirmButton().disabled).toBe(true);
    });

    it('すべて変更なしなら確定できない', async () => {
        await open(vi.fn().mockResolvedValue(okPreview([row(2, 'a', 'unchanged')])));
        await pickCsv();
        expect(confirmButton().disabled).toBe(true);
    });

    it('CSVが読めなければ理由を出す。確定に失敗したら理由を出し、もう一度押せる', async () => {
        const onPreview = vi.fn<(input: TableImportInput) => Promise<TableImportPreview>>().mockResolvedValueOnce({ ok: false, errors: ['ヘッダー行に ID の列がありません'] });
        await open(onPreview);
        await pickCsv('bad.csv');
        expect(q('table-import-errors')?.textContent).toContain('ID の列がありません');
        expect(confirmButton().disabled).toBe(true);

        const apply = vi.fn().mockRejectedValueOnce(new Error('network')).mockResolvedValueOnce({ summary: 'ok', details: [] });
        onPreview.mockResolvedValue(okPreview([row(2, 'a', 'add')], apply));
        await pickCsv('good.csv');
        confirmButton().click();
        await flushPromises();
        expect(q('table-import-error')?.textContent).toContain('network');
        confirmButton().click();
        await flushPromises();
        expect(q('table-import-result')?.textContent).toContain('ok');
    });

    describe('置き換え', () => {
        it('allowReplace でないとチェックを出さない', async () => {
            await open(vi.fn<(input: TableImportInput) => Promise<TableImportPreview>>());
            expect(q('table-import-replace')).toBeNull();
        });

        it('チェックを切り替えると mode を変えて読み直し、削除の行があれば確認してから確定する', async () => {
            const apply = vi.fn().mockResolvedValue({ summary: '削除 1', details: [] });
            const onPreview = vi.fn<(input: TableImportInput) => Promise<TableImportPreview>>().mockImplementation(async (input) =>
                okPreview(input.mode === 'replace' ? [row(2, 'a', 'unchanged'), row(null, 'old', 'delete')] : [row(2, 'a', 'unchanged')], apply),
            );
            await open(onPreview, { allowReplace: true });
            await pickCsv();
            expect(onPreview).toHaveBeenLastCalledWith(expect.objectContaining({ mode: 'upsert' }));
            expect(confirmButton().disabled).toBe(true);

            await q<HTMLInputElement>('table-import-replace')!.click();
            await flushPromises();
            expect(onPreview).toHaveBeenLastCalledWith(expect.objectContaining({ mode: 'replace' }));
            expect(q('table-import-counts')?.textContent).toContain('削除 1');
            expect(document.body.querySelectorAll('[data-testid="table-import-row"]')[1].getAttribute('data-status')).toBe('delete');
            expect(confirmButton().disabled).toBe(false);

            confirmButton().click();
            await flushPromises();
            expect(apply).not.toHaveBeenCalled(); // 削除の確認が先
            expect(confirmQueue).toHaveLength(1);
            resolveConfirm(false);
            await flushPromises();
            expect(apply).not.toHaveBeenCalled();

            confirmButton().click();
            await flushPromises();
            resolveConfirm(true);
            await flushPromises();
            expect(apply).toHaveBeenCalledTimes(1);
            expect(q('table-import-result')?.textContent).toContain('削除 1');
        });
    });

    it('開き直すと空に戻る', async () => {
        const w = await open(vi.fn().mockResolvedValue(okPreview([row(2, 'a', 'add')])));
        await pickCsv();
        expect(q('table-import-counts')).not.toBeNull();
        await w.setProps({ modelValue: false });
        await w.setProps({ modelValue: true });
        await flushPromises();
        expect(q('table-import-counts')).toBeNull();
    });
});
