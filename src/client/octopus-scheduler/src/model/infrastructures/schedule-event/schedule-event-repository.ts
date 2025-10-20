import { LocalStorageService } from "../../../../../packages/common-lib/src/storage/local-storage-service";
import type { IScheduleEventRepository } from "../../domains/schedule-event/schedule-event-repository";
import type { IScheduleEvent } from "../../domains/schedule-event/schedule-event";
import { injectable, injectAll } from "tsyringe";
import {
  IScheduleEventConverterToken,
  type IScheduleEventConverter,
} from "../../domains/schedule-event/i-schedule-event-converter";
import type { ExecutionStatus } from "../../domains/schedule-event/execution-status";
import { GasFunctionService } from "../../../../../packages/common-lib/src/google-apps-script/gas-script-service";

@injectable()
export class ScheduleEventRepository implements IScheduleEventRepository {
  private readonly localStorage: LocalStorageService;
  private readonly executionStatusStorage: LocalStorageService;
  private readonly converters: IScheduleEventConverter[];

  constructor(
    @injectAll(IScheduleEventConverterToken)
    converters: IScheduleEventConverter[]
  ) {
    this.localStorage = new LocalStorageService(
      "octopus-scheduler",
      "ScheduleEventData"
    );
    this.executionStatusStorage = new LocalStorageService(
      "octopus-scheduler",
      "ScheduleEventExecutionStatus"
    );
    this.converters = converters;
  }

  async getScheduleEvents(): Promise<IScheduleEvent[]> {
    const all = await this.localStorage.getAll<IScheduleEvent>();
    return Array.from(all.values());
  }

  async updateScheduleEvents(events: IScheduleEvent[]): Promise<void> {
    for (const event of events) {
      await this.localStorage.save(event.id, event);
    }
  }

  async deleteScheduleEvents(ids: string[]): Promise<void> {
    if (ids.length === 0) return;
    await this.localStorage.removeMultiple(ids);
  }

  async addScheduleEvents(events: IScheduleEvent[]): Promise<string> {
    const id = crypto.randomUUID();
    const promises: Promise<void>[] = [];
    for (const ev of events) {
      const newEv = { ...ev, id };
      promises.push(this.localStorage.save(id, newEv));
    }
    await Promise.all(promises);
    return id;
  }

  async syncScheduleEvents(mode: "local" | "gas" = "local"): Promise<void> {
    // Default: local -> spreadsheet (record-level)
    const sheetName = "ScheduleEvents";

    // master header: id, type, then known fields (union of all event serialize fields)
    const MASTER_HEADER = [
      "id",
      "type",
      "startTime",
      "endTime",
      "folderId",
      "displayDuration",
      "transitionType",
      "slideDirection",
      "bgmIds",
      "transitionUrl",
      "audioId",
      "contentType",
      "contentId",
      "htmlString",
      "fadeOutDuration",
      "displayMode",
      "effect",
      "duration",
      "fadeInTime",
      "fadeOutTime",
      "scrollDirection",
      "processedAt",
      "registeredAt",
      "updatedAt",
    ];

    if (mode === "gas") {
      const getService = new GasFunctionService("getSpreadsheetData");
      let remoteData: { sheetName: string; data: any[][] } | null = null;
      try {
        remoteData = await getService.call(sheetName);
      } catch (e) {
        remoteData = null;
      }

      if (!remoteData || !remoteData.data) return;

      const rows = remoteData.data;
      const revived: IScheduleEvent[] = [];

      // detect header row
      let header: string[] | null = null;
      if (rows.length > 0) {
        const first = rows[0].map((c: any) => String(c ?? ""));
        if (
          (first[0] ?? "").toLowerCase() === "id" &&
          (first[1] ?? "").toLowerCase() === "type"
        ) {
          header = first;
        }
      }

      for (let i = 0; i < rows.length; i++) {
        // skip header row
        if (i === 0 && header) continue;
        const row = rows[i];
        if (!row) continue;
        let raw: Record<string, unknown> = {};

        if (header) {
          for (let j = 0; j < header.length; j++) {
            const key = header[j];
            raw[key] = row[j];
          }
        } else {
          // fallback to legacy positions: id=0,type=1, rest as generic cols
          raw["id"] = row[0];
          raw["type"] = row[1];
          // map common columns by position if possible
          raw["startTime"] = row[2];
          raw["endTime"] = row[3];
          raw["registeredAt"] = row[row.length - 2];
          raw["updatedAt"] = row[row.length - 1];
        }

        const type = String(raw["type"] ?? "");
        const id = String(raw["id"] ?? "");
        if (!id || !type) continue;

        try {
          // use converters exclusively
          const asEvent = raw as unknown as IScheduleEvent;
          const converter = this.converters.find((c) => c.canRevive(asEvent));
          if (converter) {
            const revivedEv = converter.revive(asEvent);
            if (revivedEv) {
              await this.localStorage.save(revivedEv.id, revivedEv as any);
              revived.push(revivedEv);
            }
          } else {
            console.warn(`No converter for type=${type} id=${id}`);
          }
        } catch (e) {
          console.error(
            `Converter revive failed for row ${i + 1} type=${type} id=${id}`,
            e
          );
        }
      }

      return;
    }

    // local -> gas (existing implementation)
    // get local events
    const all = await this.localStorage.getAll<any>();
    const localEvents: IScheduleEvent[] = Array.from(all.values());

    // fetch remote sheet data
    const getService = new GasFunctionService("getSpreadsheetData");
    let remoteData: { sheetName: string; data: any[][] } | null = null;
    try {
      remoteData = await getService.call(sheetName);
    } catch (e) {
      // if sheet missing or error, remoteData stays null
      remoteData = null;
    }

    const remoteMap = new Map<
      string,
      { rowIndex: number; row: any[]; updatedAt?: string }
    >();
    if (remoteData && remoteData.data && remoteData.data.length > 0) {
      // assume rows: [id, type, ...serializeFields]
      for (let i = 0; i < remoteData.data.length; i++) {
        const row = remoteData.data[i];
        const id = String(row[0] ?? "");
        if (!id) continue;
        // try to get updatedAt from the serialized fields: assume last column contains updatedAt OR find by convention
        const updatedAt = row[row.length - 1];
        remoteMap.set(id, { rowIndex: i + 1, row, updatedAt });
      }
    }

    const addList: Array<{ id: string; type: string; row: any[] }> = [];
    const updateList: Array<{ id: string; type: string; row: any[] }> = [];

    for (const ev of localEvents) {
      const id = ev.id;
      const remote = remoteMap.get(id);
      const localUpdated = (ev as any).updatedAt
        ? new Date((ev as any).updatedAt)
        : new Date(0);
      const remoteUpdated =
        remote && remote.updatedAt ? new Date(remote.updatedAt) : new Date(0);

      // build row according to MASTER_HEADER (excluding id,type)
      const rowVals: any[] = MASTER_HEADER.slice(2).map((field) => {
        const v = (ev as any)[field];
        if (v == null) return "";
        if (v instanceof Date) return v.toISOString();
        if (Array.isArray(v)) return v.join(",");
        return String(v);
      });

      if (!remote) addList.push({ id, type: (ev as any).type, row: rowVals });
      else if (localUpdated > remoteUpdated)
        updateList.push({ id, type: (ev as any).type, row: rowVals });
    }

    // call GAS functions
    const addService = new GasFunctionService("addSpreadsheetRecords");
    const updateService = new GasFunctionService("updateSpreadsheetRecords");

    try {
      if (addList.length > 0) {
        // if remote sheet missing, add header as first record
        const payloadRecords: any[] = [];
        if (!remoteData) {
          // header row as record
          payloadRecords.push({
            id: "id",
            type: "type",
            row: MASTER_HEADER.slice(2),
          });
        }
        for (const r of addList) payloadRecords.push(r);
        const payload = JSON.stringify({ sheetName, records: payloadRecords });
        await addService.call(payload);
      }
      if (updateList.length > 0) {
        const payload = JSON.stringify({ sheetName, records: updateList });
        await updateService.call(payload);
      }
    } catch (e) {
      console.error("syncScheduleEvents failed", e);
    }

    return Promise.resolve();
  }

  async getExecutionStatus(eventId: string): Promise<ExecutionStatus | null> {
    const status =
      await this.executionStatusStorage.get<ExecutionStatus>(eventId);
    return (status as ExecutionStatus) || null;
  }

  async updateExecutionStatus(
    eventId: string,
    status: ExecutionStatus
  ): Promise<void> {
    await this.executionStatusStorage.save<ExecutionStatus>(eventId, status);
  }

  async getAllExecutionStatuses(): Promise<{
    [eventId: string]: ExecutionStatus;
  }> {
    const allStatuses =
      await this.executionStatusStorage.getAll<ExecutionStatus>();
    const result: { [eventId: string]: ExecutionStatus } = {};
    for (const [k, v] of allStatuses.entries()) {
      result[k] = v as ExecutionStatus;
    }
    return result;
  }
}
