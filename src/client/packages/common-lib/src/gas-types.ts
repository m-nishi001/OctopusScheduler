/**
 * GAS関数呼び出しのレスポンス。
 *
 * NOTE: このファイルはビルド互換性のためにクライアントパッケージ側に複製されています。
 * Canonical source: ../../../../../server/common/src/gas-types.ts
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
