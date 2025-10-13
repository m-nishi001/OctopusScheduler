export enum ExecutionStatus {
  NotStarted = "not-started",
  Started = "started",
  Completed = "completed",
  Failed = "failed",
}

export class ScheduleEventExecutionStatus {
  public readonly eventId: string;
  public readonly status: ExecutionStatus;
  public readonly startedAt?: Date;
  public readonly completedAt?: Date;
  public readonly failedAt?: Date;
  public readonly errorMessage?: string;

  constructor(
    eventId: string,
    status: ExecutionStatus,
    startedAt?: Date,
    completedAt?: Date,
    failedAt?: Date,
    errorMessage?: string
  ) {
    this.eventId = eventId;
    this.status = status;
    this.startedAt = startedAt;
    this.completedAt = completedAt;
    this.failedAt = failedAt;
    this.errorMessage = errorMessage;
  }

  static create(eventId: string): ScheduleEventExecutionStatus {
    return new ScheduleEventExecutionStatus(
      eventId,
      ExecutionStatus.NotStarted
    );
  }

  markAsStarted(): ScheduleEventExecutionStatus {
    return new ScheduleEventExecutionStatus(
      this.eventId,
      ExecutionStatus.Started,
      new Date(),
      undefined,
      undefined,
      undefined
    );
  }

  markAsCompleted(): ScheduleEventExecutionStatus {
    return new ScheduleEventExecutionStatus(
      this.eventId,
      ExecutionStatus.Completed,
      this.startedAt,
      new Date(),
      undefined,
      undefined
    );
  }

  markAsFailed(errorMessage: string): ScheduleEventExecutionStatus {
    return new ScheduleEventExecutionStatus(
      this.eventId,
      ExecutionStatus.Failed,
      this.startedAt,
      undefined,
      new Date(),
      errorMessage
    );
  }
}
