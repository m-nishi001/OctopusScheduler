import type { Player } from "../../domains/entities/result";
import type { Time } from "../../domains/value-objects/time";

export interface ResultDto {
  id: string;
  player: Player;
  time: Time;
  rank: number;
}
