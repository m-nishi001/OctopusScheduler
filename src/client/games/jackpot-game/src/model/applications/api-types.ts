import type { Prize } from "../domains/prize/Prize";

export interface GetPrizesRequest {}
export interface GetPrizesResponse { prizes: Prize[]; }
export interface ErrorResponse { code: string; message: string; }

// 他API型も必要に応じて追加
