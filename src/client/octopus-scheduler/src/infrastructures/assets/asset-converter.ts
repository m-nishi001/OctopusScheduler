/**
 * BlobデータとBase64文字列の相互変換、およびエンティティ再構築を行うヘルパークラス
 */
export class AssetConverter {
    /**
     * BlobデータをBase64形式に変換するヘルパー関数（Web Workerを使用）
     */
    public static blobToBase64(blob: Blob): Promise<string> {
        return new Promise((resolve, reject) => {
            const worker = new Worker(
              new URL('../../utils/worker/blob-to-base64-worker.ts', import.meta.url)
            );
            worker.onmessage = (event) => {
                if (event.data.error) {
                    reject(new Error(event.data.error));
                } else {
                    resolve(event.data);
                }
                worker.terminate();
            };
            worker.onerror = (error) => {
                reject(error);
                worker.terminate();
            };
            worker.postMessage({ blob });
        });
    }

    /**
     * Base64形式の文字列をBlobに変換します。
     */
    public static base64ToBlob(base64: string, contentType: string): Blob {
        const byteCharacters = atob(base64);
        const byteNumbers = new Array(byteCharacters.length);
        for (let i = 0; i < byteCharacters.length; i++) {
            byteNumbers[i] = byteCharacters.charCodeAt(i);
        }
        const byteArray = new Uint8Array(byteNumbers);
        return new Blob([byteArray], { type: contentType });
    }
}