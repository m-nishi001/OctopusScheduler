import { GasFunctionService } from "/root/google_apps_script/octopus-scheduler/src/client/packages/common-lib/src/google-apps-script/gas-script-service.ts";
import type { IScheduleRepository } from "src/domains/schedule/repository/schedule-repository";
import { Schedule } from "src/domains/schedule/entity/schedule";
import { ScheduleMapper } from "./schedule-mapper";
import { LocalStorageService } from "/root/google_apps_script/octopus-scheduler/src/client/packages/common-lib/src/storage/local-storage-service.ts";
import { StorageConfig } from "src/infrastructures/storage-config";
import { ScheduleMetadata } from "src/domains/schedule/vo/schedule-metadata";

/**
 * ScheduleエンティティをGAS経由で永続化するためのリポジトリ
 */
export class ScheduleRepository implements IScheduleRepository {
    private readonly service;
    private readonly storage: LocalStorageService;
    private readonly scheduleStoreName = "ScheduleData";
    private readonly scheduleMetadataStoreName = "ScheduleMetadataStore";

    constructor() {
        const apiName = "octopus-scheduler";
        const service = GasFunctionService.create(apiName);
        if (!service) {
            throw new Error(`Failed to create GasFunctionService for API: ${apiName}`);
        }
        this.service = service;
        this.storage = new LocalStorageService(StorageConfig.getDbName(), this.scheduleStoreName);
    }

    /**
     * スケジュールIDに基づいてスケジュールを取得する
     * ローカルストレージを最初に検索し、なければリモートと同期して再取得
     */
    public async findById(id: string): Promise<Schedule | null> {
        let json = await this.storage.get<any>(id);
        if (!json) {
            console.log(`Schedule with ID ${id} not found locally. Starting sync...`);
            await this.sync();
            json = await this.storage.get<any>(id);
        }
        return json ? ScheduleMapper.toDomain(json) : null;
    }

    /**
     * すべてのスケジュールを取得する
     * ローカルストレージを最初に検索し、なければリモートと同期して再取得
     */
    public async findAll(): Promise<Schedule[]> {
        let jsonArray = await this.storage.getAll<any>();
        if (jsonArray.size === 0) {
            console.log("No schedules found locally. Starting sync...");
            await this.sync();
            jsonArray = await this.storage.getAll<any>();
        }
        return Array.from(jsonArray.values()).map(ScheduleMapper.toDomain);
    }

    /**
     * スケジュールを保存または更新する
     */
    public async save(schedule: Schedule): Promise<void> {
        try {
            const json = ScheduleMapper.toJSON(schedule);
            await this.storage.save<any>(schedule.id, JSON.parse(json));
            console.log("Schedule saved to local storage.");

            await this.service.createCall<string>("ScheduleService.save", json)
                .withSuccessed(() => {
                    console.log("Schedule saved successfully to remote.");
                })
                .withFailuered((message: string) => {
                    throw new Error(`Failed to save schedule to remote: ${message}`);
                })
                .invoke();
        } catch (error) {
            console.error(`Failed to save schedule:`, error);
            throw new Error("Failed to save schedule.");
        }
    }

    /**
     * スケジュールを削除する
     */
    public async delete(id: string): Promise<void> {
        try {
            await this.storage.delete(id);
            console.log(`Schedule with ID ${id} deleted from local storage.`);

            await this.service.createCall<string>("ScheduleService.delete", id)
                .withSuccessed(() => {
                    console.log("Schedule deleted successfully from remote.");
                })
                .withFailuered((message: string) => {
                    throw new Error(`Failed to delete schedule from remote: ${message}`);
                })
                .invoke();
        } catch (error) {
            console.error(`Failed to delete schedule:`, error);
            throw new Error("Failed to delete schedule.");
        }
    }

    /**
     * ローカルストレージとリモートのGoogle Apps Script APIを同期します。
     * リモートに存在するメタデータに基づいて、ローカルのデータを更新または削除します。
     */
    public async sync(): Promise<void> {
        try {
            const remoteMetadatas = await this.getRemoteMetadatas();
            if (remoteMetadatas.length === 0) {
                console.log("No remote schedule metadata found. Sync skipped.");
                return;
            }

            const localMetadatas = await this.getLocalMetadatas();
            const remoteMetadataMap = new Map<string, ScheduleMetadata>(remoteMetadatas.map(meta => [meta.scheduleId, meta]));
            const localMetadataMap = new Map<string, ScheduleMetadata>(Array.from(localMetadatas.values()).map(meta => [meta.scheduleId, meta]));

            await this.removeStaleSchedules(remoteMetadataMap, localMetadataMap);
            await this.fetchAndUpdateSchedules(remoteMetadatas, localMetadataMap);

        } catch (error) {
            console.error("An error occurred during sync:", error);
            throw new Error("Failed to sync schedules.");
        }
    }

    private async getRemoteMetadatas(): Promise<ScheduleMetadata[]> {
        let remoteMetadatas = new Array<ScheduleMetadata>;
        const metadataCall = this.service.createCall<ScheduleMetadata[]>("ScheduleService.getScheduleMetadatas");
        await metadataCall
            .withTimeout(20000)
            .withSuccessed(metadatas => {
                if (metadatas) {
                    remoteMetadatas = metadatas;
                }
            })
            .withFailuered(message => console.error("Failed to get remote schedule metadata:", message))
            .invoke();
        return remoteMetadatas;
    }

    private async getLocalMetadatas(): Promise<Map<string, ScheduleMetadata>> {
        const localMetadataStorage = new LocalStorageService(StorageConfig.getDbName(), this.scheduleMetadataStoreName);
        return await localMetadataStorage.getAll<ScheduleMetadata>();
    }

    private async removeStaleSchedules(
        remoteMetadataMap: Map<string, ScheduleMetadata>,
        localMetadataMap: Map<string, ScheduleMetadata>
    ): Promise<void> {
        const schedulesToRemove = Array.from(localMetadataMap.keys())
            .filter(scheduleId => !remoteMetadataMap.has(scheduleId));

        if (schedulesToRemove.length > 0) {
            console.log("Removing locally-deleted remote schedules:", schedulesToRemove);
            await this.storage.removeMultiple(schedulesToRemove);
            const localMetadataStorage = new LocalStorageService(StorageConfig.getDbName(), this.scheduleMetadataStoreName);
            await localMetadataStorage.removeMultiple(schedulesToRemove);
        }
    }

    private async fetchAndUpdateSchedules(
        remoteMetadatas: ScheduleMetadata[],
        localMetadataMap: Map<string, ScheduleMetadata>
    ): Promise<void> {
        const schedulesToUpdate = remoteMetadatas.filter(remoteMeta => {
            const localMeta = localMetadataMap.get(remoteMeta.scheduleId);
            return !localMeta || localMeta.lastUpdatedAt < remoteMeta.lastUpdatedAt;
        });

        if (schedulesToUpdate.length > 0) {
            console.log("Found schedules to update:", schedulesToUpdate.map(s => s.scheduleId));
            const remoteSchedules: any[] = [];

            const schedulePromises = schedulesToUpdate.map(meta =>
                this.service
                    .createCall<any>("ScheduleService.findById", meta.scheduleId)
                    .withTimeout(20000)
                    .withSuccessed(data => {
                        if (data) {
                            remoteSchedules.push(data);
                        }
                    })
            );

            await this.service.all(...schedulePromises);

            const schedulesToSave = new Map<string, any>(remoteSchedules.map(schedule => [schedule.id, schedule]));
            await this.storage.saveMultiple<any>(schedulesToSave);

            const localMetadataStorage = new LocalStorageService(StorageConfig.getDbName(), this.scheduleMetadataStoreName);
            const metadatasToSave = new Map<string, ScheduleMetadata>(schedulesToUpdate.map(meta => [meta.scheduleId, meta]));
            await localMetadataStorage.saveMultiple<ScheduleMetadata>(metadatasToSave);

            console.log(`Successfully updated ${remoteSchedules.length} schedules and their metadata.`);
        } else {
            console.log("No schedules to update. Local data is up-to-date.");
        }
    }
}