import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useObjectUrlStore } from './use-object-url-store';

describe('useObjectUrlStore', () => {
  let nextUrlId = 0;
  let createObjectURLSpy: ReturnType<typeof vi.fn>;
  let revokeObjectURLSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    nextUrlId = 0;
    createObjectURLSpy = vi.fn(() => `blob:mock-${nextUrlId++}`);
    revokeObjectURLSpy = vi.fn();
    vi.stubGlobal('URL', {
      ...URL,
      createObjectURL: createObjectURLSpy,
      revokeObjectURL: revokeObjectURLSpy,
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('creates a URL for a blob on first use', () => {
    const store = useObjectUrlStore();
    const blob = new Blob(['a']);

    const url = store.ensure('bgm', blob);

    expect(url).toBe('blob:mock-0');
    expect(createObjectURLSpy).toHaveBeenCalledTimes(1);
  });

  it('reuses the existing URL when the same blob reference is passed again', () => {
    const store = useObjectUrlStore();
    const blob = new Blob(['a']);

    const first = store.ensure('bgm', blob);
    const second = store.ensure('bgm', blob);

    expect(second).toBe(first);
    expect(createObjectURLSpy).toHaveBeenCalledTimes(1);
  });

  it('revokes the old URL and creates a new one when the blob changes', () => {
    const store = useObjectUrlStore();
    const blobA = new Blob(['a']);
    const blobB = new Blob(['b']);

    const first = store.ensure('bgm', blobA);
    const second = store.ensure('bgm', blobB);

    expect(revokeObjectURLSpy).toHaveBeenCalledWith(first);
    expect(second).not.toBe(first);
    expect(createObjectURLSpy).toHaveBeenCalledTimes(2);
  });

  it('revokes the URL and returns null when the blob becomes null', () => {
    const store = useObjectUrlStore();
    const blob = new Blob(['a']);
    const url = store.ensure('bgm', blob);

    const result = store.ensure('bgm', null);

    expect(result).toBeNull();
    expect(revokeObjectURLSpy).toHaveBeenCalledWith(url);
  });

  it('keeps separate URLs for different keys', () => {
    const store = useObjectUrlStore();
    const blobA = new Blob(['a']);
    const blobB = new Blob(['b']);

    const urlA = store.ensure('option-1', blobA);
    const urlB = store.ensure('option-2', blobB);

    expect(urlA).not.toBe(urlB);
  });

  it('revoke() explicitly releases a key', () => {
    const store = useObjectUrlStore();
    const blob = new Blob(['a']);
    const url = store.ensure('option-1', blob);

    store.revoke('option-1');

    expect(revokeObjectURLSpy).toHaveBeenCalledWith(url);
  });

  it('revoke() on an untracked key is a no-op', () => {
    const store = useObjectUrlStore();
    expect(() => store.revoke('missing')).not.toThrow();
    expect(revokeObjectURLSpy).not.toHaveBeenCalled();
  });

  it('clearAll() revokes every tracked URL', () => {
    const store = useObjectUrlStore();
    const urlA = store.ensure('a', new Blob(['a']));
    const urlB = store.ensure('b', new Blob(['b']));

    store.clearAll();

    expect(revokeObjectURLSpy).toHaveBeenCalledWith(urlA);
    expect(revokeObjectURLSpy).toHaveBeenCalledWith(urlB);
  });
});
