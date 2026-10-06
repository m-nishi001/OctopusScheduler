import { afterEach, describe, expect, it } from 'vitest';
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils';
import FeedbackHost from './feedback-host.vue';
import { confirmQueue, toasts, useConfirm, useToast } from '../../composables/use-feedback';

let wrapper: VueWrapper | null = null;
afterEach(() => {
    wrapper?.unmount();
    wrapper = null;
    confirmQueue.splice(0);
    toasts.value = [];
});

const buttons = () => Array.from(document.body.querySelectorAll<HTMLButtonElement>('.ui-dialog__footer button'));

describe('useConfirm / FeedbackHost', () => {
    it('主操作で true、キャンセルで false を返す', async () => {
        wrapper = mount(FeedbackHost, { attachTo: document.body });
        const { confirm } = useConfirm();
        const yes = confirm({ message: 'よろしいですか?' });
        await flushPromises();
        buttons()[1].click();
        expect(await yes).toBe(true);

        const no = confirm({ message: '2回目' });
        await flushPromises();
        buttons()[0].click();
        expect(await no).toBe(false);
    });

    it('キャンセルで後続の確認を誤って解決しない', async () => {
        wrapper = mount(FeedbackHost, { attachTo: document.body });
        const { confirm } = useConfirm();
        const first = confirm({ message: '1' });
        let secondSettled = false;
        confirm({ message: '2' }).then(() => (secondSettled = true));
        await flushPromises();
        buttons()[0].click();
        expect(await first).toBe(false);
        await flushPromises();
        expect(secondSettled).toBe(false);
        expect(document.body.textContent).toContain('2');
    });

    it('showCancel=false は OK ボタンのみ', async () => {
        wrapper = mount(FeedbackHost, { attachTo: document.body });
        const p = useConfirm().confirm({ message: 'm', showCancel: false });
        await flushPromises();
        expect(buttons()).toHaveLength(1);
        buttons()[0].click();
        expect(await p).toBe(true);
    });

    it('toast を表示し、クリックで消える', async () => {
        wrapper = mount(FeedbackHost, { attachTo: document.body });
        useToast().error('失敗しました', 0);
        await flushPromises();
        const el = document.body.querySelector<HTMLElement>('.ui-toast--error')!;
        expect(el.textContent).toContain('失敗しました');
        el.click();
        await flushPromises();
        expect(document.body.querySelector('.ui-toast')).toBeNull();
    });
});
