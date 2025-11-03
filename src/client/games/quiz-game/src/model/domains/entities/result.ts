import type { Time } from "../value-objects/time";

export interface Result {
  id: string;
  name: string;
  time: Time;
  rank: number;
}
