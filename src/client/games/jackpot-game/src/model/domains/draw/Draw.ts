import type { Member } from "../member/Member";

export interface Draw {
  id: string;
  name: string;
  candidates: Member[];
  status: 'pending' | 'drawing' | 'completed';
  createdAt: string;
}