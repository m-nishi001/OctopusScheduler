import type { User } from '../domains/user/User';

export interface ResultResponse {
  drawId: string;
  winners: User[];
  executedAt: string;
}
