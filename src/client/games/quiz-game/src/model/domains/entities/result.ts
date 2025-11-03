import type { Player } from "./player";
import type { Time } from "../value-objects/time";

export interface Result {
  id: string;
  player: Player;
  time: Time;
  rank: number;
}
