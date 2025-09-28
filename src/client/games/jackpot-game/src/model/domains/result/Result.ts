import type { DrawResult } from "../draw-result/DrawResult";

export interface Result {
    drawId: string;
    results: DrawResult[];
    executedAt: string;
}
