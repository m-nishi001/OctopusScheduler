import localforage from 'localforage';
import type { IStorageService } from './storage-service';
import type { StoredData } from './storage-data';

export class LocalStorageService implements IStorageService {
    constructor() {
        localforage.config({
            name: 'octopus-scheduler-db',
            storeName: 'dataItems'
        });
    }

    async save(id: string, data: any): Promise<void> {
        const storedData: StoredData<typeof data> = {
            data: data,
            updatedAt: Date.now(), // 現在のタイムスタンプを付与
        };
        await localforage.setItem(id, storedData);
    }

    async get<T>(id: string): Promise<T | undefined> {
        const storedData: StoredData<T> | null = await localforage.getItem(id);
        return storedData?.data; // データが見つかれば data 部分を返し、そうでなければ undefined
    }

    async delete(id: string): Promise<void> {
        await localforage.removeItem(id);
    }

    async clear(): Promise<void> {
        await localforage.clear();
    }
}