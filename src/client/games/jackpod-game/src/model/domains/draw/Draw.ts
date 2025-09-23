import type { User } from "../user/User";

export interface Draw {
  id: string;
  name: string;
  candidates: User[];
  status: 'pending' | 'drawing' | 'completed';
  createdAt: string;
}