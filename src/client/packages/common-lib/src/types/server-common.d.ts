declare module "@octopus/server-common" {
  /**
   * GAS関数呼び出しのレスポンス（クライアント側解決用の宣言）。
   * Canonical definition lives in server/common/src/gas-types.ts
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
}
