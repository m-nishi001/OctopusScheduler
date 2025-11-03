import type { Time } from "../value-objects/time";

export interface Player {
  id: string;
  name: string;
}

export interface Result {
  id: string;
  player: Player;
  time: Time;
  rank: number;
}
