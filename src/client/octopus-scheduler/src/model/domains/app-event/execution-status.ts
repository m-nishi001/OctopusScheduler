export type ExecutionStatus = "pending" | "running" | "completed";

export class ScheduleEventExecutionStatus {
  public readonly eventId: string;
  public readonly status: ExecutionStatus;

  constructor(eventId: string, status: ExecutionStatus) {
    this.eventId = eventId;
    this.status = status;
  }
}
