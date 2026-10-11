import { buildPortalUrl } from "../../shared/host-navigation";
import type { CreateSessionArgs } from "../../shared/protocol";
import type { SessionMeta, SessionSummary } from "../../shared/session-types";
import type { SessionHubApi } from "../../server/session-hub-api-contract";

/** セッションの作成・一覧・終了(管理者向けの低頻度な操作)と、参加用URLの組み立て。 */
export class SessionAdminRepository {
  constructor(private readonly api: SessionHubApi) {}

  list(): Promise<SessionSummary[]> {
    return this.api.listSessions();
  }

  create(args: CreateSessionArgs): Promise<SessionMeta> {
    return this.api.createSession(args);
  }

  close(sessionId: string): Promise<void> {
    return this.api.closeSession({ sessionId });
  }

  /** 参加者ポータルの入口にするセッションを指定する(同時に1つだけ。published=false で公開を止める)。 */
  setPortalSession(sessionId: string, published: boolean): Promise<void> {
    return this.api.setPortalSession({ sessionId, published });
  }

  /**
   * アプリの絶対URL(ハッシュなし)。GAS ではデプロイURLを基点にし
   * (window.location は内側の iframe になるため)、取得できなければ現在のURLを使う。
   */
  async appBaseUrl(location: { origin: string; pathname: string } = window.location): Promise<string> {
    let base: string | null = null;
    try {
      base = (await this.api.getWebAppUrl()).url;
    } catch {
      base = null;
    }
    return base ?? `${location.origin}${location.pathname}`;
  }

  /** 参加者がQRから開くポータルの絶対URL。 */
  async portalUrl(code: string, location?: { origin: string; pathname: string }): Promise<string> {
    return buildPortalUrl(code, await this.appBaseUrl(location));
  }
}
