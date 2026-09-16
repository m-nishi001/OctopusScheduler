/**
 * GAS 関数呼び出しの共通レスポンス。
 *
 * クライアント（common-lib）とサーバ（server/common）の双方から利用する
 * フレームワーク非依存の契約。以前は両者に複製されていた。
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
