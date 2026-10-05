import { describe, it, expect } from 'vitest';
import { mount } from '@vue/test-utils';
import PageShell from './page-shell.vue';

const tabs = [
  { key: 'a', label: 'A' },
  { key: 'b', label: 'B' },
];

describe('PageShell', () => {
  it('renders tabs and marks the active one', () => {
    const w = mount(PageShell, { props: { title: 'T', tabs, activeKey: 'b' }, slots: { default: 'body' } });
    const els = w.findAll('[role="tab"]');
    expect(els).toHaveLength(2);
    expect(els[1].classes()).toContain('is-active');
    expect(w.text()).toContain('body');
  });

  it('emits select when a tab is clicked', async () => {
    const w = mount(PageShell, { props: { title: 'T', tabs, activeKey: 'a' } });
    await w.findAll('[role="tab"]')[1].trigger('click');
    expect(w.emitted('select')?.[0]).toEqual(['b']);
  });
});
