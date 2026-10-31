import { afterEach, describe, expect, it } from 'vitest';
import { mount, type VueWrapper } from '@vue/test-utils';
import SyncStatusIndicator from './sync-status-indicator.vue';

let wrapper: VueWrapper | null = null;
afterEach(() => {
    wrapper?.unmount();
    wrapper = null;
});

const mountIndicator = (props: Record<string, unknown>) => {
    wrapper = mount(SyncStatusIndicator, { props: props as any, attachTo: document.body });
    return wrapper;
};
const dialog = () => document.body.querySelector('.ui-dialog') as HTMLElement | null;

describe('SyncStatusIndicator', () => {
    it('状態に応じたラベルを表示し、エラー時のツールチップは失敗の理由にする', () => {
        expect(mountIndicator({ status: 'idle' }).get('button').text()).toBe('同期済み');
        wrapper?.unmount();
        expect(mountIndicator({ status: 'syncing' }).get('button').text()).toBe('同期中...');
        wrapper?.unmount();
        const err = mountIndicator({ status: 'error', lastError: '失敗' });
        expect(err.get('button').text()).toBe('同期エラー(押すと詳細)');
        expect(err.get('button').attributes('title')).toBe('失敗');
    });

    it('押せるボタンで、押すまで詳細のダイアログは出ない', async () => {
        const w = mountIndicator({ status: 'idle' });
        expect(w.get('button').element.tagName).toBe('BUTTON');
        expect(dialog()).toBeNull();
        await w.get('button').trigger('click');
        expect(dialog()).not.toBeNull();
    });

    it('記録が無ければ、その旨を出す', async () => {
        const w = mountIndicator({ status: 'idle', log: [] });
        await w.get('button').trigger('click');
        expect(dialog()?.textContent).toContain('記録はありません');
    });

    it('記録を、時刻・対象・結果・理由の行で出す(対象の表示名は kindLabels、素材は id も併記)', async () => {
        const w = mountIndicator({
            status: 'error',
            lastError: '1件の同期に失敗しました: HTTP 500: boom',
            kindLabels: { screens: '画面設定', asset: '素材' },
            log: [
                { at: Date.UTC(2026, 9, 31, 3, 0, 0), kind: 'screens', id: 'screens', event: 'pulledFromOther' },
                { at: Date.UTC(2026, 9, 31, 2, 59, 0), kind: 'screens', id: 'screens', event: 'pushFailed', error: 'HTTP 500: boom' },
                { at: Date.UTC(2026, 9, 31, 2, 58, 0), kind: 'asset', id: 'a1', event: 'pullFailed', error: 'timeout' },
            ],
        });
        await w.get('button').trigger('click');
        const rows = Array.from(document.body.querySelectorAll('[data-testid="sync-log"] tbody tr')).map((tr) => tr.textContent ?? '');
        expect(rows).toHaveLength(3);
        expect(rows[0]).toContain('画面設定');
        expect(rows[0]).toContain('他の端末の変更を反映');
        expect(rows[1]).toContain('送信に失敗');
        expect(rows[1]).toContain('HTTP 500: boom');
        expect(rows[2]).toContain('素材 (a1)');
        expect(rows[2]).toContain('取り込みに失敗');
        expect(dialog()?.textContent).toContain('1件の同期に失敗しました');
    });
});
