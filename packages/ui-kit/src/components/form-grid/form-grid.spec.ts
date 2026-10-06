import { describe, it, expect } from 'vitest';
import { mount } from '@vue/test-utils';
import FormGrid from './form-grid.vue';
import UiField from './ui-field.vue';

describe('FormGrid / UiField', () => {
    it('UiField がラベル・必須印・エラーを表示する', () => {
        const w = mount(UiField, {
            props: { label: '名前', required: true, error: '必須です', hint: 'ヒント' },
            slots: { default: '<input />' },
        });
        expect(w.text()).toContain('名前*');
        expect(w.find('[role="alert"]').text()).toBe('必須です');
        expect(w.text()).not.toContain('ヒント');
    });

    it('full 指定で全幅クラスが付く', () => {
        const w = mount(UiField, { props: { label: 'a', full: true } });
        expect(w.classes()).toContain('ui-form-grid__full');
    });

    it('FormGrid は子要素を描画する', () => {
        const w = mount(FormGrid, { slots: { default: '<span class="x" />' } });
        expect(w.find('.x').exists()).toBe(true);
    });
});
