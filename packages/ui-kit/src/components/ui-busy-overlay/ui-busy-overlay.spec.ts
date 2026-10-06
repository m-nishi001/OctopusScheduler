import { afterEach, describe, expect, it } from 'vitest';
import { mount, type VueWrapper } from '@vue/test-utils';
import UiBusyOverlay from './ui-busy-overlay.vue';

let w: VueWrapper | null = null;
afterEach(() => w?.unmount());

describe('UiBusyOverlay', () => {
    it('visible のときだけタイトルとメッセージを表示する', async () => {
        w = mount(UiBusyOverlay, { props: { visible: false, title: '保存中...', message: '少々お待ちください' }, attachTo: document.body });
        expect(document.body.querySelector('.ui-busy')).toBeNull();
        await w.setProps({ visible: true });
        expect(document.body.querySelector('.ui-busy')?.textContent).toContain('保存中...');
        expect(document.body.querySelector('.ui-busy')?.textContent).toContain('少々お待ちください');
    });
});
