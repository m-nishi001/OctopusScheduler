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

function readState(storage: IKeyValueStorage): RemoteControlState {
  const raw = storage.get(REMOTE_CONTROL_KEY);
  if (!raw) return INITIAL_STATE;
  try {
    return JSON.parse(raw) as RemoteControlState;
  } catch {
    return INITIAL_STATE;
  }
}

function writeState(
  storage: IKeyValueStorage,
  state: RemoteControlState
): void {
  storage.set(REMOTE_CONTROL_KEY, JSON.stringify(state));
}

/**
 * 演出画面が今表示すべき画面を設定する。演出画面側はポーリングでこの値の
 * 変化を検知し、自ら router.push で遷移する。
 */
export function setRemoteScreen(
  deps: RemoteControlDeps,
  args: { screen: JackpotRemoteScreen }
): RemoteControlState {
  const current = readState(deps.storage);
  const state: RemoteControlState = {
    ...current,
    screen: args.screen,
    updatedAtMs: deps.now(),
  };
  writeState(deps.storage, state);
  return state;
}

/**
 * 「次へ」(本番画面でのEnterキー相当の進行操作)を1件発行する。actionSeqを
 * 1つ進めるだけで、進行先の具体的な意味は演出画面側のロジックに委ねる。
 */
export function advanceRemoteAction(
  deps: RemoteControlDeps
): RemoteControlState {
  const current = readState(deps.storage);
  const state: RemoteControlState = {
    ...current,
    actionSeq: current.actionSeq + 1,
    updatedAtMs: deps.now(),
  };
  writeState(deps.storage, state);
  return state;
}

/** 演出画面・管理画面のポーリング用の軽量参照。 */
export function getRemoteControlState(
  deps: RemoteControlDeps
): RemoteControlState {
  return readState(deps.storage);
}
