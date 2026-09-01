/**
 * GAS関数呼び出しのレスポンス。
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
