/**
 * Shared contract types used across client and server boundaries.
 * These types are intentionally framework-independent so they can be reused
 * without coupling the app layers to browser or GAS implementations.
 */
export type GasResponse<T> =
  | {
      status: "success";
      data: T;
    }
  | {
      status: "error";
      message: string;
    };

export type AsyncStatus = "idle" | "loading" | "success" | "error";
