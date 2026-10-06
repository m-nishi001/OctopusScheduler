import { describe, it, expect } from 'vitest';
import { mount } from '@vue/test-utils';
import UiButton from './ui-button.vue';

describe('UiButton', () => {
    it('既定は type=button で、variant/size のクラスが付く', () => {
        const w = mount(UiButton, { props: { variant: 'primary', size: 'sm' }, slots: { default: '保存' } });
        expect(w.attributes('type')).toBe('button');
        expect(w.classes()).toContain('ui-button--primary');
        expect(w.classes()).toContain('ui-button--sm');
        expect(w.text()).toBe('保存');
    });

    it('loading 中は無効化されクリックを発火しない', async () => {
        const w = mount(UiButton, { props: { loading: true } });
        expect(w.attributes('disabled')).toBeDefined();
        expect(w.find('.ui-button__spinner').exists()).toBe(true);
    });

    it('icon を表示する', () => {
        const w = mount(UiButton, { props: { icon: 'delete', iconOnly: true } });
        expect(w.find('svg').exists()).toBe(true);
        expect(w.classes()).toContain('is-icon-only');
    });
});
