import { describe, expect, it } from 'vitest';
import { mount } from '@vue/test-utils';
import SyncStatusIndicator from './sync-status-indicator.vue';

describe('SyncStatusIndicator', () => {
    it('状態に応じたラベルを表示し、エラー時のみツールチップを出す', () => {
        expect(mount(SyncStatusIndicator, { props: { status: 'idle' } }).text()).toBe('同期済み');
        expect(mount(SyncStatusIndicator, { props: { status: 'syncing' } }).text()).toBe('同期中...');
        const err = mount(SyncStatusIndicator, { props: { status: 'error', lastError: '失敗' } });
        expect(err.text()).toBe('同期エラー');
        expect(err.attributes('title')).toBe('失敗');
    });
});
