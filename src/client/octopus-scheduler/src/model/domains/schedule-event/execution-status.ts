export enum ExecutionStatus {
  Pending = "pending",
  Running = "running",
  Completed = "completed",
}

export class ScheduleEventExecutionStatus {
  public readonly eventId: string;
  public readonly status: ExecutionStatus;

  constructor(eventId: string, status: ExecutionStatus) {
    this.eventId = eventId;
    this.status = status;
  }

  static create(eventId: string): ScheduleEventExecutionStatus {
    return new ScheduleEventExecutionStatus(eventId, ExecutionStatus.Pending);
  }

  markAsStarted(): ScheduleEventExecutionStatus {
    return new ScheduleEventExecutionStatus(
      this.eventId,
      ExecutionStatus.Running
    );
  }

  markAsCompleted(): ScheduleEventExecutionStatus {
    return new ScheduleEventExecutionStatus(
      this.eventId,
      ExecutionStatus.Completed
    );
  }

  markAsFailed(): ScheduleEventExecutionStatus {
    return new ScheduleEventExecutionStatus(
      this.eventId,
      ExecutionStatus.Completed
    );
  }
}
