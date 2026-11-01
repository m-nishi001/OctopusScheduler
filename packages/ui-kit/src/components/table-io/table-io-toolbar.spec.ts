import { afterEach, describe, expect, it, vi } from 'vitest';
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils';
import TableIoToolbar from './table-io-toolbar.vue';
import FeedbackHost from '../feedback/feedback-host.vue';

const wrappers: VueWrapper[] = [];
afterEach(() => wrappers.splice(0).forEach((w) => w.unmount()));
const setup = (props: Record<string, unknown> = {}) => {
    const w = mount(TableIoToolbar, { props: { count: 3, ...props }, attachTo: document.body });
    wrappers.push(w, mount(FeedbackHost, { attachTo: document.body }));
    return w;
};

describe('TableIoToolbar', () => {
    it('並びは CSVダウンロード / 素材も含める / CSVから取り込む / n件', () => {
        const w = setup({ onExport: vi.fn(), mediaLabel: '写真も含める(ZIP)' });
        const ids = Array.from((w.element as HTMLElement).querySelectorAll('[data-testid]')).map((e) => e.getAttribute('data-testid'));
        expect(ids).toEqual(['table-export', 'table-export-media', 'table-import-open', 'table-count']);
        expect(w.text()).toContain('3件');
    });

    it('onExport が無ければダウンロードを出さない。importable=false なら取込も出さない', () => {
        const w = setup({ importable: false });
        expect(w.find('[data-testid="table-export"]').exists()).toBe(false);
        expect(w.find('[data-testid="table-import-open"]').exists()).toBe(false);
    });

    it('素材の指定が無ければチェックは無く、includeMedia は常に偽', async () => {
        const onExport = vi.fn().mockResolvedValue(undefined);
        const w = setup({ onExport });
        expect(w.find('[data-testid="table-export-media"]').exists()).toBe(false);
        await w.find('[data-testid="table-export"]').trigger('click');
        expect(onExport).toHaveBeenCalledWith({ includeMedia: false });
    });

    it('チェックすると includeMedia が真。取込ボタンは import を送る', async () => {
        const onExport = vi.fn().mockResolvedValue(undefined);
        const w = setup({ onExport, mediaLabel: '素材も含める(ZIP)' });
        await w.find('[data-testid="table-export-media"]').setValue(true);
        await w.find('[data-testid="table-export"]').trigger('click');
        expect(onExport).toHaveBeenCalledWith({ includeMedia: true });
        await w.find('[data-testid="table-import-open"]').trigger('click');
        expect(w.emitted('import')).toHaveLength(1);
    });

    it('書き出しに失敗したらエラーを出す', async () => {
        const w = setup({ onExport: vi.fn().mockRejectedValue(new Error('boom')) });
        await w.find('[data-testid="table-export"]').trigger('click');
        await flushPromises();
        expect(document.body.textContent).toContain('書き出しに失敗しました: boom');
    });
});
