import type { ApiCallOptions, BlobRoute, IApiClient } from "../interfaces/api-client";
import type { HashedBlobDeps } from "../compositions/hashed-blobs";

/** `createHashedBlobStore` の、GAS 用(データURL)の入口。 */
interface DataUrlBlobStore {
  put(deps: HashedBlobDeps, args: { hash: string; dataUrl: string }): Promise<void>;
  get(deps: HashedBlobDeps, args: { hash: string }): Promise<{ dataUrl: string | null }>;
}

/**
 * テスト用の `IApiClient`。ファイルの送受信は、サーバーのファイル置き場(メモリ上)に中身を置いて受け渡す。
 * jsdom + localforage では保存した Blob を読み戻すと本物の Blob ではなくなり中身を読めないので、
 * 中身は固定(`ABC`)にして、「置いた・取れた・消えた」だけを確かめられるようにする。ハッシュと中身の一致は見ない。
 */
export function createFakeBlobApiClient(store: DataUrlBlobStore, deps: HashedBlobDeps, mime = "image/png"): IApiClient {
  return {
    call: async () => {
      throw new Error("not used in this test");
    },
    putBlob: async (_route: BlobRoute, hash: string, blob: Blob, _options?: ApiCallOptions) =>
      store.put(deps, { hash, dataUrl: `data:${blob.type || mime};base64,QUJD` }),
    getBlob: async (_route: BlobRoute, hash: string, _options?: ApiCallOptions) => {
      const { dataUrl } = await store.get(deps, { hash });
      const type = dataUrl ? (/^data:([^;]+)/.exec(dataUrl)?.[1] ?? mime) : mime;
      return dataUrl ? new Blob(["ABC"], { type }) : null;
    },
  };
}
