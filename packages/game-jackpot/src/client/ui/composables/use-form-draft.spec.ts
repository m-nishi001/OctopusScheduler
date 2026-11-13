import { describe, it, expect } from 'vitest';
import { useFormDraft } from './use-form-draft';

type Cfg = { sec: number; mode: string; bgms: string[] };
const EMPTY: Cfg = { sec: 4, mode: 'auto', bgms: [] };

/** 読み込みの完了を手で操作できる取得関数。 */
function controlledFetch() {
  const pending: Array<(v: Cfg) => void> = [];
  const fail: Array<(e: unknown) => void> = [];
  const fetch = () => new Promise<Cfg>((resolve, reject) => { pending.push(resolve); fail.push(reject); });
  return { fetch, resolve: (v: Cfg, i = 0) => pending[i](v), reject: (e: unknown, i = 0) => fail[i](e), calls: () => pending.length };
}
const tick = () => new Promise((r) => setTimeout(r, 0));

describe('useFormDraft', () => {
  it('読み込み前に入力した値は、読み込みが終わっても消えない(不具合の再現)', async () => {
    const c = controlledFetch();
    const form = useFormDraft(EMPTY, c.fetch);
    const loading = form.load();
    form.set('sec', 9);
    expect(form.view.value.sec).toBe(9);
    c.resolve({ sec: 4, mode: 'fixed', bgms: ['a'] });
    await loading;
    expect(form.view.value.sec).toBe(9); // 触った項目は入力のまま
    expect(form.view.value.mode).toBe('fixed'); // 触っていない項目は読み込んだ値
    expect(form.dirty.value).toBe(true);
  });

  it('同期でサーバーの値が変わっても、触った項目は残り、触っていない項目は新しい値になる', async () => {
    let server: Cfg = { sec: 4, mode: 'auto', bgms: [] };
    const form = useFormDraft(EMPTY, async () => ({ ...server }));
    await form.load();
    form.set('sec', 9);
    server = { sec: 6, mode: 'fixed', bgms: ['x'] };
    await form.load();
    expect(form.view.value).toEqual({ sec: 9, mode: 'fixed', bgms: ['x'] });
  });

  it('触っていなければ dirty ではなく、読み込み・同期の値がそのまま見える', async () => {
    let server: Cfg = { sec: 4, mode: 'auto', bgms: [] };
    const form = useFormDraft(EMPTY, async () => ({ ...server }));
    expect(form.dirty.value).toBe(false);
    await form.load();
    server = { sec: 7, mode: 'auto', bgms: [] };
    await form.load();
    expect(form.view.value.sec).toBe(7);
    expect(form.dirty.value).toBe(false);
  });

  it('0・空文字・false に変えた項目も、入力として残る', async () => {
    const form = useFormDraft<{ n: number; s: string; b: boolean }>({ n: 1, s: 'a', b: true }, async () => ({ n: 1, s: 'a', b: true }));
    await form.load();
    form.set('n', 0); form.set('s', ''); form.set('b', false);
    expect(form.view.value).toEqual({ n: 0, s: '', b: false });
  });

  it('保存は読み込みの完了を待ち、base に draft を重ねたものを送る', async () => {
    const c = controlledFetch();
    const form = useFormDraft(EMPTY, c.fetch);
    const loading = form.load();
    form.set('sec', 9);
    const sent: Cfg[] = [];
    const saving = form.save(async (s) => { sent.push(s); });
    await tick();
    expect(sent).toEqual([]); // まだ読み込み中なので送らない
    c.resolve({ sec: 4, mode: 'fixed', bgms: ['a'] });
    await loading;
    // 保存後の読み直し用
    await tick();
    c.resolve({ sec: 9, mode: 'fixed', bgms: ['a'] }, 1);
    await saving;
    expect(sent).toEqual([{ sec: 9, mode: 'fixed', bgms: ['a'] }]); // 4 に戻らず、読み込んだ mode も欠けない
  });

  it('保存に成功したら draft を空にし、読み直した値が見える', async () => {
    let server: Cfg = { sec: 4, mode: 'auto', bgms: [] };
    const form = useFormDraft(EMPTY, async () => ({ ...server }));
    await form.load();
    form.set('sec', 9);
    await form.save(async (s) => { server = s; });
    expect(form.dirty.value).toBe(false);
    expect(form.view.value.sec).toBe(9);
  });

  it('保存に失敗したら draft は残る', async () => {
    const form = useFormDraft(EMPTY, async () => ({ ...EMPTY }));
    await form.load();
    form.set('sec', 9);
    await expect(form.save(async () => { throw new Error('boom'); })).rejects.toThrow('boom');
    expect(form.dirty.value).toBe(true);
    expect(form.view.value.sec).toBe(9);
  });

  it('保存中に入力した項目は draft に残り、保存した項目だけが消える', async () => {
    let server: Cfg = { sec: 4, mode: 'auto', bgms: [] };
    const form = useFormDraft(EMPTY, async () => ({ ...server }));
    await form.load();
    form.set('sec', 9);
    await form.save(async (s) => {
      server = s;
      form.set('mode', 'fixed'); // 保存の最中の入力
      form.set('sec', 11); // 保存した項目を、さらに書き換えた
    });
    expect(form.view.value.mode).toBe('fixed');
    expect(form.view.value.sec).toBe(11);
    expect(form.dirty.value).toBe(true);
  });

  it('配列は edit で写しを編集し、読み込んだ値(base)を書き換えない', async () => {
    const server: Cfg = { sec: 4, mode: 'auto', bgms: ['a'] };
    const form = useFormDraft(EMPTY, async () => ({ ...server, bgms: [...server.bgms] }));
    await form.load();
    form.edit('bgms', (b) => { b.push('b'); });
    form.edit('bgms', (b) => { b.splice(0, 1); });
    expect(form.view.value.bgms).toEqual(['b']);
    await form.load();
    expect(form.view.value.bgms).toEqual(['b']);
    form.discard();
    expect(form.view.value.bgms).toEqual(['a']);
  });

  it('discard で入力を捨てると、サーバーの値に戻り dirty でなくなる', async () => {
    const form = useFormDraft(EMPTY, async () => ({ ...EMPTY }));
    await form.load();
    form.set('sec', 9);
    form.discard();
    expect(form.dirty.value).toBe(false);
    expect(form.view.value.sec).toBe(4);
  });

  it('読み込みに失敗したままでは保存しない(既定値で上書きしない)', async () => {
    const c = controlledFetch();
    const form = useFormDraft(EMPTY, c.fetch);
    const loading = form.load();
    c.reject(new Error('offline'));
    await loading;
    expect(form.status.value).toBe('failed');
    let sent = false;
    await expect(form.save(async () => { sent = true; })).rejects.toThrow();
    expect(sent).toBe(false);
  });

  it('遅れて返った古い読み込みは捨てる', async () => {
    const c = controlledFetch();
    const form = useFormDraft(EMPTY, c.fetch);
    const first = form.load();
    const second = form.load();
    c.resolve({ sec: 8, mode: 'auto', bgms: [] }, 1);
    await second;
    c.resolve({ sec: 5, mode: 'auto', bgms: [] }, 0);
    await first;
    expect(form.view.value.sec).toBe(8);
  });
});
