import type { DrawPair } from "../../../domains/draw/draw-service";

export interface DrawResponse {
  drawId: string;
  status: "pending" | "drawing" | "completed";
  pairs?: DrawPair[];
}
