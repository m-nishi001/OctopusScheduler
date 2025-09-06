import type { IEvent } from "./event";
import { ScheduleState } from "../vo/schedule-state";

export class Schedule {
  public state: ScheduleState;
  private events: IEvent[];

  /**
   * 新しいスケジュールを生成するためのファクトリーメソッド
   * @returns 新しいScheduleエンティティ
   */
  public static createNew(): Schedule {
    return new Schedule(crypto.randomUUID(), 1);
  }

  /**
   * 永続化されたデータからScheduleエンティティを再構築するためのファクトリーメソッド
   * @param id スケジュールID
   * @param version バージョン
   * @param events イベントのリスト
   */
  public static reconstruct(id: string, version: number, events: IEvent[] = []): Schedule {
  return new Schedule(id, version, events);
  }

  private constructor(
    public readonly id: string,
    private version: number,
    events: IEvent[] = [],
  ) {
    this.events = [...events];
    this.state = new ScheduleState("Pending");
  }

  public getVersion(): number {
    return this.version;
  }

  public getEvents(): IEvent[] {
    return [...this.events];
  }

  public addEvent(event: IEvent): void {
    this.events.push(event);
  }

  public removeEvent(eventId: string): void {
    this.events = this.events.filter(e => e.id !== eventId);
  }

  public cloneEvent(eventToClone: IEvent): IEvent {
    const newEventId = crypto.randomUUID();
    return eventToClone.clone(newEventId);
  }
}