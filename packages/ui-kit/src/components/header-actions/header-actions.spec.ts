import { describe, it, expect } from 'vitest';
import { mount } from '@vue/test-utils';
import HeaderActions from './header-actions.vue';

describe('HeaderActions', () => {
    it('ホームボタンの文言は「ホーム」で home を emit する', async () => {
        const w = mount(HeaderActions);
        const btn = w.findAll('button').at(-1)!;
        expect(btn.text()).toBe('ホーム');
        await btn.trigger('click');
        expect(w.emitted('home')).toHaveLength(1);
    });

    it('showBackup で backup ボタンを表示する', async () => {
        const w = mount(HeaderActions, { props: { showBackup: true } });
        const btn = w.findAll('button').find((b) => b.text() === 'バックアップ')!;
        await btn.trigger('click');
        expect(w.emitted('backup')).toHaveLength(1);
    });
});
