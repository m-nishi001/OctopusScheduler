/**
 * Cloudflare Worker のエントリポイント。
 *
 * GAS版(gas/index.ts)と異なり、esbuildのbanner/footerによるグローバル関数
 * 生成は不要(Workersは通常のESMを実行できるため)。各機能パッケージが
 * `server/endpoints.ts` からexportする `X_HANDLERS`/`X_PREFIX` を直接importし、
 * `${prefix}_${name}` をキーとするルートテーブルを組み立てて `/rpc` へのPOSTを
 * ディスパッチする。このキー形式は `createTypedApiClient` がクライアント側で
 * 生成する呼び出し名(`interfaces/typed-api-client.ts`)と完全に一致する。
 *
 * 静的アセット(Vueクライアント)は `env.ASSETS` バインディング経由でそのまま
 * 配信する(GASの `doGet`/HtmlService に相当)。
 */
import "reflect-metadata";
import { container } from "tsyringe";
import { registerCloudflareInfrastructures } from "./container";
import { runWithRequestEnv } from "./request-context";
import type { CloudflareEnv } from "./env";

import { QUIZ_GAME_PREFIX, QUIZ_GAME_HANDLERS } from "@octopus/game-quiz/server";
import { JACKPOT_GAME_PREFIX, JACKPOT_GAME_HANDLERS } from "@octopus/game-jackpot/server";
import { OCTOPUS_SCHEDULER_PREFIX, OCTOPUS_SCHEDULER_HANDLERS } from "@octopus/app-scheduler/server";
import { ACCOUNTS_PREFIX, ACCOUNTS_HANDLERS } from "@octopus/accounts/server";
import { SESSION_HUB_PREFIX, SESSION_HUB_HANDLERS, resolveKvDeps } from "@octopus/session-hub/server";
import { ISessionHubBackendToken, createKvBackend } from "@octopus/session-hub/backend";
import { createDoBackend } from "./session-hub-backend";
import { currentEnv } from "./request-context";

// Durable Object クラスは Worker のエントリから export する(wrangler.toml の class_name と一致させる)。
export { SessionRoom } from "./session-room";

type Handler = (args: unknown) => Promise<string>;

const ROUTES: Record<string, Handler> = {};

function mount(prefix: string, handlers: Record<string, Handler>): void {
  for (const [name, fn] of Object.entries(handlers)) {
    ROUTES[`${prefix}_${name}`] = fn;
  }
}

mount(QUIZ_GAME_PREFIX, QUIZ_GAME_HANDLERS);
mount(JACKPOT_GAME_PREFIX, JACKPOT_GAME_HANDLERS);
mount(OCTOPUS_SCHEDULER_PREFIX, OCTOPUS_SCHEDULER_HANDLERS);
mount(ACCOUNTS_PREFIX, ACCOUNTS_HANDLERS);
mount(SESSION_HUB_PREFIX, SESSION_HUB_HANDLERS);

registerCloudflareInfrastructures();

// session-hub: Durable Object のバインディングがあれば DO(WebSocket push・直列実行)を、
// 無ければ R2 + ロックの実装を使う(wrangler.toml が古い環境でも動くように)。
const doBackend = createDoBackend(resolveKvDeps);
container.register(ISessionHubBackendToken, {
  useFactory: () => (currentEnv().SESSION_ROOM ? doBackend : createKvBackend(resolveKvDeps())),
});

interface RpcRequestBody {
  name: string;
  args?: unknown;
}

async function handleRpc(request: Request): Promise<Response> {
  let body: RpcRequestBody;
  try {
    body = await request.json<RpcRequestBody>();
  } catch {
    return Response.json({ status: "error", message: "Invalid JSON body" }, { status: 400 });
  }

  const handler = ROUTES[body.name];
  if (!handler) {
    return Response.json({ status: "error", message: `Unknown endpoint: ${body.name}` }, { status: 404 });
  }

  const responseJson = await handler(body.args);
  return new Response(responseJson, { headers: { "Content-Type": "application/json" } });
}

const SESSION_ID_PATTERN = /^[A-Za-z0-9_-]{1,64}$/;

/** `/ws/<sessionId>` の WebSocket 接続を、そのセッションの Durable Object へ転送する。 */
async function handleWebSocket(request: Request, env: CloudflareEnv, sessionId: string): Promise<Response> {
  if (!env.SESSION_ROOM) return new Response("WebSocket is not available", { status: 501 });
  if (!SESSION_ID_PATTERN.test(sessionId)) return new Response("Bad session id", { status: 400 });
  if (request.headers.get("Upgrade") !== "websocket") return new Response("Expected WebSocket upgrade", { status: 426 });
  const stub = env.SESSION_ROOM.get(env.SESSION_ROOM.idFromName(sessionId));
  const forwarded = new Request("https://session-room/ws", request);
  return stub.fetch(forwarded);
}

export default {
  async fetch(request: Request, env: CloudflareEnv, _ctx: ExecutionContext): Promise<Response> {
    return runWithRequestEnv(env, async () => {
      const url = new URL(request.url);
      if (url.pathname === "/rpc" && request.method === "POST") {
        return handleRpc(request);
      }
      if (url.pathname.startsWith("/ws/")) {
        return handleWebSocket(request, env, decodeURIComponent(url.pathname.slice("/ws/".length)));
      }
      return env.ASSETS.fetch(request);
    });
  },
};
