import { afterEach, describe, expect, it, vi } from 'vitest';
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils';
import MemberEditor from './member-editor.vue';
import FeedbackHost from '../feedback/feedback-host.vue';
import { confirmQueue } from '../../composables/use-feedback';

const wrappers: VueWrapper[] = [];
afterEach(() => {
    wrappers.splice(0).forEach((w) => w.unmount());
    confirmQueue.splice(0);
});

function setup(props: Record<string, unknown> = {}) {
    const onAdd = vi.fn().mockResolvedValue(undefined);
    const onUpdate = vi.fn().mockResolvedValue(undefined);
    const onDelete = vi.fn().mockResolvedValue(undefined);
    const w = mount(MemberEditor, {
        props: { members: [{ id: 'a', name: 'Alice' }], onAdd, onUpdate, onDelete, ...props },
        attachTo: document.body,
    });
    wrappers.push(w, mount(FeedbackHost, { attachTo: document.body }));
    return { w, onAdd, onUpdate, onDelete };
}
const dialogButtons = () => Array.from(document.body.querySelectorAll<HTMLButtonElement>('.ui-dialog__footer button'));

describe('MemberEditor', () => {
    it('名前入力で追加でき、IDは空なら undefined', async () => {
        const { w, onAdd } = setup();
        await w.find('.ui-member-editor__toolbar button').trigger('click');
        await flushPromises();
        const inputs = document.body.querySelectorAll<HTMLInputElement>('.ui-member-editor__form input');
        inputs[1].value = 'Bob';
        inputs[1].dispatchEvent(new Event('input'));
        await flushPromises();
        dialogButtons()[1].click();
        await flushPromises();
        expect(onAdd).toHaveBeenCalledWith({ id: undefined, name: 'Bob' });
    });

    it('idRequired の場合はIDが空だと保存できない', async () => {
        const { w } = setup({ idRequired: true });
        await w.find('.ui-member-editor__toolbar button').trigger('click');
        await flushPromises();
        const inputs = document.body.querySelectorAll<HTMLInputElement>('.ui-member-editor__form input');
        inputs[1].value = 'Bob';
        inputs[1].dispatchEvent(new Event('input'));
        await flushPromises();
        expect(dialogButtons()[1].disabled).toBe(true);
    });

    it('削除は確認後に onDelete を呼ぶ', async () => {
        const { w, onDelete } = setup();
        await w.find('button[aria-label="削除"]').trigger('click');
        await flushPromises();
        const ok = Array.from(document.body.querySelectorAll<HTMLButtonElement>('.ui-dialog__footer button')).at(-1)!;
        ok.click();
        await flushPromises();
        expect(onDelete).toHaveBeenCalledWith(['a']);
    });

    it('確認でキャンセルすると削除しない', async () => {
        const { w, onDelete } = setup();
        await w.find('button[aria-label="削除"]').trigger('click');
        await flushPromises();
        document.body.querySelectorAll<HTMLButtonElement>('.ui-dialog__footer button')[0].click();
        await flushPromises();
        expect(onDelete).not.toHaveBeenCalled();
    });
});
