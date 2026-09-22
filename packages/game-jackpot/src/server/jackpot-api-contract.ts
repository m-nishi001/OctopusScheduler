/**
 * jackpot-game の GAS エンドポイント契約(唯一の正準定義)。
 */
export const JACKPOT_GAME_PREFIX = "jackpotGame" as const;

export const JACKPOT_GAME_ENDPOINTS = [
  "addDriveData",
  "getDriveMetaData",
  "getDriveData",
  "addJson",
  "getJson",
] as const;

export type JackpotGameEndpointName = (typeof JACKPOT_GAME_ENDPOINTS)[number];

export type JackpotGameFunctionName =
  `${typeof JACKPOT_GAME_PREFIX}_${JackpotGameEndpointName}`;
