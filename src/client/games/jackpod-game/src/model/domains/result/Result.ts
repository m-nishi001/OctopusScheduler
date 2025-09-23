import type { User } from "../user/User";

export interface Result {
  drawId: string;
  winners: User[];
  executedAt: string;
}
