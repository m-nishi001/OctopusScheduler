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
