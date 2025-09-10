import type { IAssetType } from "../vo/asset-type";

export class Asset {

    private _assetId: string;
    private _assetName: string;
    private _assetData: Blob;
    private _updatedAt: Date;
    private _assetType: IAssetType;

    private constructor(
        assetId: string,
        assetName: string,
        assetData: Blob,
        assetType: IAssetType,
        updatedAt: Date = new Date()
    ) {
        this._assetId = assetId;
        this._assetName = assetName;
        this._assetData = assetData;
        this._assetType = assetType;
        this._updatedAt = updatedAt;
    }

    static create(
        assetType: IAssetType,
        assetName: string = "",
        assetData: Blob = new Blob(),
        assetId: string = "",
        updatedAt: Date = new Date()
    ): Asset {
        return new Asset(assetId, assetName, assetData, assetType, updatedAt);
    }

    static from(source: Asset): Asset {
        return new Asset(
            source.assetId,
            source.assetName,
            source.assetData,
            source.assetType,
            new Date(source.updatedAt)
        );
    }

    static async fromServer(source: Asset): Promise<Asset> {
        return new Asset(
            source.assetId,
            source.assetName,
            await Asset.base64ToBlob(source.assetData as unknown as string),
            source.assetType,
            new Date(source.updatedAt)
        );
    }

    serialize(): Asset {
        return {
            assetId: this.assetId,
            assetName: this.assetName,
            assetType: this.assetType,
            assetData: this.assetData,
            updatedAt: this.updatedAt,
        } as Asset;
    }

    async serializeForServer(): Promise<Asset> {
        return {
            assetId: this.assetId,
            assetName: this.assetName,
            assetType: this.assetType,
            assetData: await Asset.blobToBase64(this.assetData),
            updatedAt: this.updatedAt,
        } as Asset;
    }

    updateAssetName(newName: string): void {
        this._assetName = newName;
    }

    updateAssetData(newData: Blob): void {
        this._assetData = newData;
    }

    get assetId(): string {
        return this._assetId;
    }

    get assetName(): string {
        return this._assetName;
    }

    get assetType(): IAssetType {
        return this._assetType;
    }

    get assetData(): any {
        return this._assetData;
    }

    get audioId(): string {
        return this._assetId;
    }

    get audioName(): string {
        return this._assetName;
    }

    get updatedAt(): Date {
        return this._updatedAt;
    }

    private static blobToBase64(blob: Blob): Promise<string> {
        // Workerスクリプトを文字列で定義
        const workerScript = `
            self.onmessage = function(e) {
                const blob = e.data;
                const reader = new FileReader();
                reader.onloadend = function() {
                    // dataURL形式（"data:mime/type;base64,..."）全体を返す
                    const dataUrl = reader.result;
                    self.postMessage({ base64: dataUrl });
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
     * DataURL形式のBase64文字列をBlobに変換します（Web Worker使用）。
     * MIMEタイプはDataURLから自動抽出します。
     * 例: data:image/png;base64,xxxxxx
     */
    public static base64ToBlob(dataUrl: string): Promise<Blob> {
        const workerScript = `
            self.onmessage = function(e) {
                const dataUrl = e.data;
                if (!dataUrl || typeof dataUrl !== 'string' || dataUrl.trim() === '') {
                    self.postMessage({ error: 'Invalid dataUrl input: empty or not a string' });
                    return;
                }
                const match = dataUrl.match(/^data:([^;]+);base64,(.*)$/);
                if (!match) {
                    self.postMessage({ error: 'Input is not a valid DataURL format.' });
                    return;
                }
                const mimeType = match[1];
                const base64 = match[2];
                let decodedBase64 = base64.replace(/\\s/g, '');
                try {
                    decodedBase64 = decodeURIComponent(decodedBase64);
                } catch (ex) {
                    // decodeURIComponent失敗時はそのまま
                }
                let byteCharacters;
                try {
                    byteCharacters = atob(decodedBase64);
                } catch (e) {
                    self.postMessage({ error: 'Failed to decode base64: ' + (e instanceof Error ? e.message : String(e)) });
                    return;
                }
                const byteNumbers = new Array(byteCharacters.length);
                for (let i = 0; i < byteCharacters.length; i++) {
                    byteNumbers[i] = byteCharacters.charCodeAt(i);
                }
                const byteArray = new Uint8Array(byteNumbers);
                const blob = new Blob([byteArray], { type: mimeType });
                self.postMessage({ blob });
            };
        `;
        const blobURL = URL.createObjectURL(new Blob([workerScript], { type: 'application/javascript' }));
        return new Promise((resolve, reject) => {
            const worker = new Worker(blobURL);
            let finished = false;
            worker.onmessage = (e) => {
                finished = true;
                if (e.data && e.data.blob) {
                    resolve(e.data.blob);
                } else {
                    reject(new Error(e.data?.error || 'Failed to convert base64 to blob'));
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
            worker.postMessage(dataUrl);
        });
    }

}