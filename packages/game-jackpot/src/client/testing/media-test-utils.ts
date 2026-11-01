import { vi } from "vitest";

/**
 * 素材のハッシュ計算のテスト用の環境。この環境の jsdom には `crypto.subtle` も `Blob.arrayBuffer` も無いので、
 * 中身から決まる値を返す簡易なもの(同じ内容 → 同じハッシュ)に差し替える。テストファイルの先頭で1回呼ぶ。
 */
export function installMediaTestEnv(): void {
  vi.stubGlobal("crypto", {
    subtle: {
      digest: async (_algorithm: string, data: ArrayBuffer) => {
        const out = new Uint8Array(32);
        let h = 2166136261;
        new Uint8Array(data).forEach((b, i) => {
          h = Math.imul(h ^ b, 16777619) >>> 0;
          out[i % 32] ^= h & 255;
        });
        for (let i = 0; i < 32; i++) {
          h = Math.imul(h ^ out[i] ^ i, 16777619) >>> 0;
          out[i] = h & 255;
        }
        return out.buffer;
      },
    },
    randomUUID: (() => {
      let n = 0;
      return () => `uuid-${++n}`;
    })(),
  });
  Blob.prototype.arrayBuffer ??= function (this: Blob) {
    return new Promise<ArrayBuffer>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as ArrayBuffer);
      reader.onerror = () => reject(reader.error);
      reader.readAsArrayBuffer(this);
    });
  };
}
