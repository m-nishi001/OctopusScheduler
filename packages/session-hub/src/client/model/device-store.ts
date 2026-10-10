/**
 * 端末の入室情報(sessionId/deviceId/token と、ホストが適用済みの seq)をリロードを跨いで保持する。
 * スマホの誤リロードやタブの再読み込みから自動で復帰するためのもの。
 *
 * localStorage が使えない環境(プライベートブラウズ等)でも例外にせず、メモリ上で動く。
 */
export interface DeviceStore {
  get(key: string): string | null;
  set(key: string, value: string): void;
  remove(key: string): void;
}

export class MemoryDeviceStore implements DeviceStore {
  private readonly map = new Map<string, string>();
  get(key: string): string | null {
    return this.map.get(key) ?? null;
  }
  set(key: string, value: string): void {
    this.map.set(key, value);
  }
  remove(key: string): void {
    this.map.delete(key);
  }
}

export function createBrowserDeviceStore(storage?: Storage): DeviceStore {
  const fallback = new MemoryDeviceStore();
  let backing: Storage | null = null;
  try {
    backing = storage ?? (typeof localStorage !== "undefined" ? localStorage : null);
  } catch {
    backing = null;
  }
  return {
    get(key) {
      try {
        return backing ? backing.getItem(key) : fallback.get(key);
      } catch {
        return fallback.get(key);
      }
    },
    set(key, value) {
      try {
        if (backing) backing.setItem(key, value);
        else fallback.set(key, value);
      } catch {
        fallback.set(key, value);
      }
    },
    remove(key) {
      try {
        if (backing) backing.removeItem(key);
        else fallback.remove(key);
      } catch {
        fallback.remove(key);
      }
    },
  };
}

/** 保存する入室情報。 */
export interface StoredCredentials {
  sessionId: string;
  deviceId: string;
  token: string;
  role: "host" | "admin" | "client";
  label: string;
  /** 参加者の再入室(コードで復帰)に使う。 */
  code?: string;
  /** ホストが適用済みの最後の seq。 */
  appliedSeq: number;
}

/** host/admin/client は同一ブラウザで別々に保持する(管理とホストを同じブラウザで試す場合がある)。 */
export const credentialsKey = (role: StoredCredentials["role"]): string => `octopus.session.${role}`;

export function loadCredentials(store: DeviceStore, role: StoredCredentials["role"]): StoredCredentials | null {
  const raw = store.get(credentialsKey(role));
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<StoredCredentials>;
    if (
      typeof parsed.sessionId === "string" &&
      typeof parsed.deviceId === "string" &&
      typeof parsed.token === "string" &&
      parsed.role === role
    ) {
      return {
        sessionId: parsed.sessionId,
        deviceId: parsed.deviceId,
        token: parsed.token,
        role,
        label: typeof parsed.label === "string" ? parsed.label : "",
        code: typeof parsed.code === "string" ? parsed.code : undefined,
        appliedSeq: typeof parsed.appliedSeq === "number" ? parsed.appliedSeq : 0,
      };
    }
  } catch {
    // 壊れた記録は無視して消す
  }
  store.remove(credentialsKey(role));
  return null;
}

export function saveCredentials(store: DeviceStore, creds: StoredCredentials): void {
  store.set(credentialsKey(creds.role), JSON.stringify(creds));
}

export function clearCredentials(store: DeviceStore, role: StoredCredentials["role"]): void {
  store.remove(credentialsKey(role));
}
