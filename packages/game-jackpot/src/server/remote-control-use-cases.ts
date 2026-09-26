import type { IKeyValueStorage } from "@octopus/infrastructures/interfaces";
import type {
  JackpotRemoteScreen,
  RemoteControlState,
} from "./jackpot-api-contract";

export interface RemoteControlDeps {
  storage: IKeyValueStorage;
  /** 現在時刻(ms)を返す関数。GAS本番では Date.now() を注入する。 */
  now: () => number;
}

const REMOTE_CONTROL_KEY = "jackpot-game/remote-control";

const INITIAL_STATE: RemoteControlState = {
  screen: null,
  actionSeq: 0,
  updatedAtMs: 0,
};

async function readState(storage: IKeyValueStorage): Promise<RemoteControlState> {
  const raw = await storage.get(REMOTE_CONTROL_KEY);
  if (!raw) return INITIAL_STATE;
  try {
    return JSON.parse(raw) as RemoteControlState;
  } catch {
    return INITIAL_STATE;
  }
}

async function writeState(
  storage: IKeyValueStorage,
  state: RemoteControlState
): Promise<void> {
  await storage.set(REMOTE_CONTROL_KEY, JSON.stringify(state));
}

/**
 * 演出画面が今表示すべき画面を設定する。演出画面側はポーリングでこの値の
 * 変化を検知し、自ら router.push で遷移する。
 */
export async function setRemoteScreen(
  deps: RemoteControlDeps,
  args: { screen: JackpotRemoteScreen }
): Promise<RemoteControlState> {
  const current = await readState(deps.storage);
  const state: RemoteControlState = {
    ...current,
    screen: args.screen,
    updatedAtMs: deps.now(),
  };
  await writeState(deps.storage, state);
  return state;
}

/**
 * 「次へ」(本番画面でのEnterキー相当の進行操作)を1件発行する。actionSeqを
 * 1つ進めるだけで、進行先の具体的な意味は演出画面側のロジックに委ねる。
 */
export async function advanceRemoteAction(
  deps: RemoteControlDeps
): Promise<RemoteControlState> {
  const current = await readState(deps.storage);
  const state: RemoteControlState = {
    ...current,
    actionSeq: current.actionSeq + 1,
    updatedAtMs: deps.now(),
  };
  await writeState(deps.storage, state);
  return state;
}

/** 演出画面・管理画面のポーリング用の軽量参照。 */
export async function getRemoteControlState(
  deps: RemoteControlDeps
): Promise<RemoteControlState> {
  return readState(deps.storage);
}
