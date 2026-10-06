import { describe, it, expect } from 'vitest';
import { mount } from '@vue/test-utils';
import UiIcon from './ui-icon.vue';
import { UI_ICON_PATHS } from './icons';

describe('UiIcon', () => {
    it('指定した名前のpathを描画する', () => {
        const w = mount(UiIcon, { props: { name: 'add' } });
        expect(w.findAll('path')).toHaveLength(UI_ICON_PATHS.add.length);
        expect(w.attributes('aria-hidden')).toBe('true');
    });
});
