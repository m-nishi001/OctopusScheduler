import { describe, it, expect } from 'vitest';
import { mount } from '@vue/test-utils';
import DataTable from './data-table.vue';

describe('DataTable', () => {
  it('renders rows with data-label for responsive layout', () => {
    const w = mount(DataTable, {
      props: { columns: [{ key: 'n', label: 'Name' }], rows: [{ n: 'x' }, { n: 'y' }] },
    });
    const cells = w.findAll('tbody td');
    expect(cells).toHaveLength(2);
    expect(cells[0].attributes('data-label')).toBe('Name');
    expect(cells[1].text()).toBe('y');
  });
});

describe('DataTable (extended)', () => {
  const columns = [{ key: 'n', label: 'Name', sortable: true }];

  it('shows empty text and skeleton while loading', async () => {
    const w = mount(DataTable, { props: { columns, rows: [], emptyText: 'なし' } });
    expect(w.text()).toContain('なし');
    await w.setProps({ loading: true });
    expect(w.findAll('.ui-data-table__skeleton')).toHaveLength(3);
  });

  it('sorts asc → desc → none on header click', async () => {
    const w = mount(DataTable, { props: { columns, rows: [{ n: 'b' }, { n: 'a' }, { n: 'c' }] } });
    const order = () => w.findAll('tbody td').map((c) => c.text());
    await w.find('.ui-data-table__sort').trigger('click');
    expect(order()).toEqual(['a', 'b', 'c']);
    await w.find('.ui-data-table__sort').trigger('click');
    expect(order()).toEqual(['c', 'b', 'a']);
    await w.find('.ui-data-table__sort').trigger('click');
    expect(order()).toEqual(['b', 'a', 'c']);
  });

  it('emits update:selected for row and select-all toggles', async () => {
    const w = mount(DataTable, {
      props: { columns, rows: [{ n: 'a' }, { n: 'b' }], rowKey: 'n', selectable: true, selected: ['a'] },
    });
    const boxes = w.findAll('input[type="checkbox"]');
    await boxes[2].setValue(true); // row b
    expect(w.emitted('update:selected')?.[0]).toEqual([['a', 'b']]);
    await boxes[0].setValue(true); // select all
    expect(w.emitted('update:selected')?.[1]).toEqual([['a', 'b']]);
  });
});
