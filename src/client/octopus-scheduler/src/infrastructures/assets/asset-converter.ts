/**
 * BlobデータとBase64文字列の相互変換、およびエンティティ再構築を行うヘルパークラス
 */
export class AssetConverter {
    /**
     * Normalize metadata responses from the API.
     * Accepts an array or an object keyed by id and returns an array of values.
     */
    public static normalizeMetadatas<T>(metadatas: any): T[] {
        if (!metadatas) return [];
        if (Array.isArray(metadatas)) return metadatas as T[];
        if (typeof metadatas === 'object') return Object.values(metadatas) as T[];
        return [];
    }

    /**
     * Extract base64 payload from various API shapes.
     * Accepts a string (pure base64 or data URL) or an object with a `data64` field.
     */
    public static extractBase64Data(payload: any): string | null {
        if (!payload) return null;
        if (typeof payload === 'string') return payload;
        if (typeof payload === 'object') {
            if (typeof payload.data64 === 'string') return payload.data64;
            // some APIs may return { data: { data64: '...' } }
            if (payload.data && typeof payload.data.data64 === 'string') return payload.data.data64;
        }
        return null;
    }
    /**
     * BlobデータをBase64形式に変換する（インラインWeb Worker利用、ObjectURL経由、メモリリーク防止）
     */
    public static blobToBase64(blob: Blob): Promise<string> {
        // Workerスクリプトを文字列で定義
        const workerScript = `
            self.onmessage = function(e) {
                const blob = e.data;
                const reader = new FileReader();
                reader.onloadend = function() {
                    // "data:mime/type;base64," の部分を削除
                    const base64 = reader.result.split(',')[1];
                    self.postMessage({ base64 });
                };
                reader.onerror = function() {
                    self.postMessage({ error: 'Failed to convert blob to base64' });
                };
                reader.readAsDataURL(blob);
            };
        `;
        const blobURL = URL.createObjectURL(new Blob([workerScript], { type: 'application/javascript' }));
        return new Promise((resolve, reject) => {
            const worker = new Worker(blobURL);
            let finished = false;
            worker.onmessage = (e) => {
                finished = true;
                if (e.data && e.data.base64) {
                    resolve(e.data.base64);
                } else {
                    reject(new Error(e.data?.error || 'Failed to convert blob to base64'));
                }
                worker.terminate();
                URL.revokeObjectURL(blobURL);
            };
            worker.onerror = (err) => {
                if (!finished) {
                    reject(new Error('Worker error: ' + err.message));
                    worker.terminate();
                    URL.revokeObjectURL(blobURL);
                }
            };
            worker.postMessage(blob);
        });
    }

    /**
     * Base64形式の文字列をBlobに変換します。
     */
    public static base64ToBlob(base64: string, contentType: string): Blob {
        // 入力検証: null/undefined/空文字列はエラー
        if (!base64 || typeof base64 !== 'string' || base64.trim() === '') {
            throw new Error('Invalid base64 input: empty or not a string');
        }
        // DataURL形式の場合はプレフィックスを除去
        const commaIdx = base64.indexOf(',');
        const pureBase64 = commaIdx >= 0 ? base64.slice(commaIdx + 1) : base64;
        // URLエンコードされている場合はデコード
        let decodedBase64 = pureBase64.replace(/\s/g, '');
        try {
            decodedBase64 = decodeURIComponent(decodedBase64);
        } catch (ex) {
            // decodeURIComponent失敗時はそのまま
            console.error('Failed to decodeURIComponent:', ex);
        }
        // atobで例外が出る場合はcatchして詳細を出す
        let byteCharacters: string;
        try {
            byteCharacters = atob(decodedBase64);
        } catch (e) {
            throw new Error('Failed to decode base64: ' + (e instanceof Error ? e.message : String(e)));
        }
        const byteNumbers = new Array(byteCharacters.length);
        for (let i = 0; i < byteCharacters.length; i++) {
            byteNumbers[i] = byteCharacters.charCodeAt(i);
        }
        const byteArray = new Uint8Array(byteNumbers);
        return new Blob([byteArray], { type: contentType });
    }
}