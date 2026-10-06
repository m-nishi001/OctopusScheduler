import { describe, expect, it } from 'vitest';
import { mount } from '@vue/test-utils';
import UiToolbar from './ui-toolbar.vue';

describe('UiToolbar', () => {
    it('子要素を toolbar ロールで描画する', () => {
        const w = mount(UiToolbar, { slots: { default: '<button>a</button>' } });
        expect(w.attributes('role')).toBe('toolbar');
        expect(w.find('button').exists()).toBe(true);
    });
});
