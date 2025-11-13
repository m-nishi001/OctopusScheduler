export class NotFoundError extends Error {
  constructor(message?: string) {
    super(message);
    this.name = "NotFoundError";
  }
}

export class StateNotInitializedError extends Error {
  constructor(message?: string) {
    super(message);
    this.name = "StateNotInitializedError";
  }
}

export class NoReservedPrizesError extends Error {
  constructor(message?: string) {
    super(message);
    this.name = "NoReservedPrizesError";
  }
}

export class NoAvailablePrizesError extends Error {
  constructor(message?: string) {
    super(message);
    this.name = "NoAvailablePrizesError";
  }
}

export class BusinessError extends Error {
  constructor(message?: string) {
    super(message);
    this.name = "BusinessError";
  }
}
