import { getCurrentInstance, onUnmounted } from 'vue';

interface ObjectUrlEntry {
  blob: Blob;
  url: string;
}

/**
 * Blobから生成したobject URLを、キーごとに使い回すためのストア。
 * 同じキーに同じBlob参照が渡された場合は既存のURLをそのまま再利用し、
 * 異なるBlob(またはnull/undefined)が渡された場合のみ古いURLを失効させて
 * 作り直す。フォームの各ファイル入力(BGM/画像など)のプレビュー用途を想定しており、
 * 再レンダリングのたびにURLを作り直してしまう不具合を防ぐ。
 * コンポーネントのunmount時には、残っている全URLを自動的に失効させる。
 */
export function useObjectUrlStore() {
  const entries = new Map<string, ObjectUrlEntry>();

  function revoke(key: string): void {
    const entry = entries.get(key);
    if (!entry) return;
    try {
      URL.revokeObjectURL(entry.url);
    } catch {
      // ignore
    }
    entries.delete(key);
  }

  function ensure(key: string, blob: Blob | null | undefined): string | null {
    const existing = entries.get(key);
    if (!blob) {
      if (existing) revoke(key);
      return null;
    }
    if (existing && existing.blob === blob) {
      return existing.url;
    }
    if (existing) revoke(key);
    const url = URL.createObjectURL(blob);
    entries.set(key, { blob, url });
    return url;
  }

  function clearAll(): void {
    for (const key of Array.from(entries.keys())) revoke(key);
  }

  if (getCurrentInstance()) {
    onUnmounted(clearAll);
  }

  return { ensure, revoke, clearAll };
}
