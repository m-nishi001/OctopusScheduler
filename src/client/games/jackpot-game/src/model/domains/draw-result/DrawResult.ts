import type { Member } from "../member/Member";
import type { Prize } from "../prize/Prize";

export interface DrawResult {
    drawId: string;
    member: Member;
    prize: Prize;
    rank: string;
    order: number;
    isWinner: boolean;
}
