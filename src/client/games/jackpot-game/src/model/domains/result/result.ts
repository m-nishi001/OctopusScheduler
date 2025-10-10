import type { DrawResult } from "../draw-result/draw-result";

export interface Result {
    drawId: string;
    results: DrawResult[];
    executedAt: string;
}
