import type { Player } from "../../domains/entities/player";
import type { Time } from "../../domains/value-objects/time";

export interface ResultDto {
  id: string;
  player: Player;
  time: Time;
  rank: number;
}
