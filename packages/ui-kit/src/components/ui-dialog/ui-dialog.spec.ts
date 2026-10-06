import { afterEach, describe, expect, it } from 'vitest';
import { mount, type VueWrapper } from '@vue/test-utils';
import UiDialog from './ui-dialog.vue';

let wrapper: VueWrapper | null = null;
afterEach(() => {
    wrapper?.unmount();
    wrapper = null;
});

const open = (props: Record<string, unknown> = {}, slots: Record<string, string> = { default: '<input class="first" />' }) => {
    wrapper = mount(UiDialog, { props: { modelValue: true, title: 'タイトル', ...props }, slots, attachTo: document.body });
    return wrapper;
};
const overlay = () => document.body.querySelector('.ui-dialog__overlay') as HTMLElement;

describe('UiDialog', () => {
    it('Escape で close を emit する', async () => {
        const w = open();
        overlay().dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
        expect(w.emitted('update:modelValue')?.[0]).toEqual([false]);
        expect(w.emitted('close')).toHaveLength(1);
    });

    it('persistent の間は Escape・オーバーレイ・×で閉じない', async () => {
        const w = open({ persistent: true });
        overlay().dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
        overlay().dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
        overlay().dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
        expect(w.emitted('close')).toBeUndefined();
        expect(document.body.querySelector('.ui-dialog__close')).toBeNull();
    });

    it('オーバーレイ上で押下して解放した場合のみ閉じる', () => {
        const w = open();
        overlay().dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
        expect(w.emitted('close')).toBeUndefined();
        overlay().dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
        overlay().dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
        expect(w.emitted('close')).toHaveLength(1);
    });

    it('標準フッターはキャンセル左・主操作右で、confirm を emit する', () => {
        const w = open({ confirmLabel: '保存' });
        const buttons = Array.from(document.body.querySelectorAll<HTMLButtonElement>('.ui-dialog__footer button'));
        expect(buttons.map((b) => b.textContent?.trim())).toEqual(['キャンセル', '保存']);
        buttons[1].click();
        expect(w.emitted('confirm')).toHaveLength(1);
    });

    it('表示中は背面スクロールを止め、閉じると戻す', async () => {
        const w = open();
        expect(document.body.style.overflow).toBe('hidden');
        await w.setProps({ modelValue: false });
        expect(document.body.style.overflow).not.toBe('hidden');
    });

    it('開いたときに本文の入力へフォーカスする', async () => {
        open();
        await new Promise((r) => setTimeout(r, 0));
        expect(document.activeElement?.classList.contains('first')).toBe(true);
    });
});
